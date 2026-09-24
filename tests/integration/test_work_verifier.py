"""Integration tests for SiteVerdict v3 (join flow + location + reference).

Four roles: creator posts, a DIFFERENT worker joins and gets approved,
a stranger attacks. Lifecycle:
OPEN -> APPLIED -> ASSIGNED -> SUBMITTED -> CONFIRMED -> APPROVED -> PAID.

Run: gltest tests/integration/test_work_verifier.py -v -s --network studionet
"""

import hashlib
import os

import pytest

from gltest import get_contract_factory
from gltest.accounts import create_account
from gltest.assertions import tx_execution_succeeded, tx_execution_failed

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "fixtures")
ZERO = "0x" + "0" * 40
LOC = "Jl. Merdeka No. 45, Bandung"


def _load_images():
    with open(os.path.join(FIXTURES, "before.png"), "rb") as f:
        before = f.read()
    with open(os.path.join(FIXTURES, "after.png"), "rb") as f:
        after = f.read()
    return before, after


def _sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _deploy():
    factory = get_contract_factory("SiteVerdict")
    return factory.deploy(args=[])


def _as(contract, account=None):
    factory = get_contract_factory("SiteVerdict")
    return factory.build_contract(
        contract_address=contract.address, account=account or create_account()
    )


def test_join_approve_flow():
    creator = _deploy()
    worker = _as(creator)
    stranger = _as(creator)
    before, after = _load_images()

    tx = creator.create_task(
        args=["v3-001", "Repaint the wall", "Two coats light blue", 5, _sha(before), LOC, ""]
    ).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-001"]).call()
    assert task["worker"] == ZERO
    assert task["location"] == LOC

    # Invalid reference URL rejected; valid stored.
    tx = creator.create_task(
        args=["v3-002", "Tiles", "Even grout", 3, "", LOC, "ftp://x/y.png"]
    ).transact()
    assert tx_execution_failed(tx)

    # Creator can never join its own job; stranger join works once.
    tx = creator.join_job(args=["v3-001"]).transact()
    assert tx_execution_failed(tx)
    tx = worker.join_job(args=["v3-001"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-001"]).call()["status"] == "APPLIED"
    tx = stranger.join_job(args=["v3-001"]).transact()
    assert tx_execution_failed(tx)

    # Submit before approval fails; approve is creator-only.
    tx = worker.submit_proof(args=["v3-001", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)
    tx = stranger.approve_worker(args=["v3-001"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.approve_worker(args=["v3-001"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-001"]).call()["status"] == "ASSIGNED"

    # Baseline binding enforced at submit.
    tx = worker.submit_proof(args=["v3-001", _sha(after), _sha(b"nope")]).transact()
    assert tx_execution_failed(tx)
    tx = worker.submit_proof(args=["v3-001", _sha(after), _sha(before)]).transact()
    assert tx_execution_succeeded(tx)

    # Resolve still locked before confirmation.
    tx = creator.resolve_task(args=["v3-001", before, after]).transact()
    assert tx_execution_failed(tx)
    tx = stranger.confirm_evidence(args=["v3-001"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.confirm_evidence(args=["v3-001"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-001"]).call()["status"] == "CONFIRMED"


def test_join_recovery():
    creator = _deploy()
    worker = _as(creator)
    stranger = _as(creator)
    before, after = _load_images()

    creator.create_task(args=["v3-010", "Tiles", "Even grout lines", 3, "", LOC, ""]).transact()

    # Worker cancels own application; stranger cannot.
    worker.join_job(args=["v3-010"]).transact()
    tx = stranger.cancel_join(args=["v3-010"]).transact()
    assert tx_execution_failed(tx)
    tx = worker.cancel_join(args=["v3-010"]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-010"]).call()
    assert task["status"] == "OPEN"
    assert task["worker"] == ZERO

    # Creator rejects an application; stranger cannot.
    worker.join_job(args=["v3-010"]).transact()
    tx = stranger.reject_join(args=["v3-010"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.reject_join(args=["v3-010"]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-010"]).call()
    assert task["status"] == "OPEN"
    assert task["worker"] == ZERO

    # Retract/reject of evidence keeps the assignment (ASSIGNED, worker kept).
    worker.join_job(args=["v3-010"]).transact()
    creator.approve_worker(args=["v3-010"]).transact()
    worker.submit_proof(args=["v3-010", _sha(after), _sha(before)]).transact()
    tx = worker.retract_proof(args=["v3-010"]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-010"]).call()
    assert task["status"] == "ASSIGNED"
    assert task["worker"] != ZERO

    worker.submit_proof(args=["v3-010", _sha(after), _sha(before)]).transact()
    tx = creator.reject_submission(args=["v3-010"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-010"]).call()["status"] == "ASSIGNED"

    # Creator cancels pre-confirm from ASSIGNED and SUBMITTED.
    tx = stranger.cancel_task(args=["v3-010"]).transact()
    assert tx_execution_failed(tx)
    worker.submit_proof(args=["v3-010", _sha(after), _sha(before)]).transact()
    tx = creator.cancel_task(args=["v3-010"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-010"]).call()["status"] == "CANCELLED"
    tx = worker.submit_proof(args=["v3-010", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)


def test_wrong_state_guards():
    """Every method rejects calls made in the wrong state."""
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()
    creator.create_task(args=["v3-050", "Paint", "Even coats", 2, "", LOC, ""]).transact()

    assert tx_execution_failed(creator.resolve_task(args=["v3-050", before, after]).transact())
    assert tx_execution_failed(creator.confirm_evidence(args=["v3-050"]).transact())
    assert tx_execution_failed(worker.claim_reward(args=["v3-050"]).transact())
    assert tx_execution_failed(worker.retract_proof(args=["v3-050"]).transact())
    assert tx_execution_failed(creator.reject_submission(args=["v3-050"]).transact())
    assert tx_execution_failed(worker.appeal(args=["v3-050", _sha(after), _sha(before)]).transact())
    assert tx_execution_failed(creator.refund(args=["v3-050"]).transact())
    assert tx_execution_failed(creator.approve_worker(args=["v3-050"]).transact())

    assert tx_execution_failed(worker.submit_proof(args=["nope", "a", "b"]).transact())
    try:
        creator.get_task(args=["nope"]).call()
        raised = False
    except Exception:
        raised = True
    assert raised

    worker.join_job(args=["v3-050"]).transact()
    creator.approve_worker(args=["v3-050"]).transact()
    worker.submit_proof(args=["v3-050", _sha(after), _sha(before)]).transact()
    creator.confirm_evidence(args=["v3-050"]).transact()
    assert tx_execution_failed(creator.cancel_task(args=["v3-050"]).transact())
    assert tx_execution_failed(worker.join_job(args=["v3-050"]).transact())
    # Anti-deadlock: evidence can still be pulled after confirmation.
    tx = worker.retract_proof(args=["v3-050"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-050"]).call()["status"] == "ASSIGNED"
    worker.submit_proof(args=["v3-050", _sha(after), _sha(before)]).transact()
    creator.confirm_evidence(args=["v3-050"]).transact()
    tx = creator.reject_submission(args=["v3-050"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-050"]).call()["status"] == "ASSIGNED"


@pytest.mark.slow
def test_hash_binding_rejects_substituted_bytes():
    """Committed hashes, confirmed, but resolve called with different bytes."""
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()

    creator.create_task(args=["v3-020", "Repaint the wall", "Clean blue, white trim", 5, "", LOC, ""]).transact()
    worker.join_job(args=["v3-020"]).transact()
    creator.approve_worker(args=["v3-020"]).transact()
    worker.submit_proof(args=["v3-020", _sha(after), _sha(before)]).transact()
    creator.confirm_evidence(args=["v3-020"]).transact()

    tampered = b"not the committed photo" + after
    tx = creator.resolve_task(args=["v3-020", before, tampered]).transact()
    assert tx_execution_failed(tx)
    assert creator.get_task(args=["v3-020"]).call()["status"] == "CONFIRMED"


@pytest.mark.slow
def test_full_approve_settles_once():
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()

    creator.create_task(
        args=["v3-030", "Repaint the living room wall", "Wall painted clean light blue, neat white trim", 5, _sha(before), LOC, ""]
    ).transact()
    worker.join_job(args=["v3-030"]).transact()
    creator.approve_worker(args=["v3-030"]).transact()
    worker.submit_proof(args=["v3-030", _sha(after), _sha(before)]).transact()
    creator.confirm_evidence(args=["v3-030"]).transact()

    tx = creator.resolve_task(args=["v3-030", before, after]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-030"]).call()
    print("VERDICT:", task["verdict"])
    if task["status"] == "REJECTED":
        tx = worker.appeal(args=["v3-030", _sha(after), _sha(before)]).transact()
        assert tx_execution_succeeded(tx)
        creator.confirm_evidence(args=["v3-030"]).transact()
        tx = creator.resolve_task(args=["v3-030", before, after]).transact()
        assert tx_execution_succeeded(tx)
        task = creator.get_task(args=["v3-030"]).call()
        print("RETRY:", task["verdict"])
    assert task["status"] == "APPROVED"
    assert task["worker"] != task["creator"]
    assert task["worker"] != ZERO
    assert len(task["evidence_history"]) == 1

    stranger = _as(creator)
    tx = stranger.claim_reward(args=["v3-030"]).transact()
    assert tx_execution_failed(tx)
    tx = worker.claim_reward(args=["v3-030"]).transact()
    assert tx_execution_succeeded(tx)
    tx = worker.claim_reward(args=["v3-030"]).transact()
    assert tx_execution_failed(tx)
    assert creator.get_task(args=["v3-030"]).call()["status"] == "PAID"

    tx = creator.refund(args=["v3-030"]).transact()
    assert tx_execution_failed(tx)


@pytest.mark.slow
def test_garbage_pair_rejected_then_worker_only_appeal():
    creator = _deploy()
    worker = _as(creator)
    with open(os.path.join(FIXTURES, "unrelated.png"), "rb") as f:
        unrelated = f.read()

    creator.create_task(args=["v3-040", "Repaint the wall", "Clean light blue paint, neat white trim", 4, "", LOC, ""]).transact()
    worker.join_job(args=["v3-040"]).transact()
    creator.approve_worker(args=["v3-040"]).transact()
    worker.submit_proof(args=["v3-040", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v3-040"]).transact()

    tx = creator.resolve_task(args=["v3-040", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-040"]).call()
    print("VERDICT:", task["verdict"])
    assert task["status"] == "REJECTED"

    stranger = _as(creator)
    before, after = _load_images()
    tx = stranger.appeal(args=["v3-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)
    tx = creator.appeal(args=["v3-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)
    tx = worker.appeal(args=["v3-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-040"]).call()
    assert task["status"] == "SUBMITTED"
    assert task["appeals_used"] == "1"
    tx = worker.appeal(args=["v3-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)

    tx = stranger.refund(args=["v3-040"]).transact()
    assert tx_execution_failed(tx)

    tx = creator.confirm_evidence(args=["v3-040"]).transact()
    assert tx_execution_succeeded(tx)
    tx = creator.resolve_task(args=["v3-040", before, after]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-040"]).call()
    print("RECOVERED:", task["verdict"])
    assert task["status"] == "APPROVED"
    assert len(task["evidence_history"]) == 2
    assert task["appeals_used"] == "1"


@pytest.mark.slow
def test_creator_refund_after_reject():
    creator = _deploy()
    worker = _as(creator)
    with open(os.path.join(FIXTURES, "unrelated.png"), "rb") as f:
        unrelated = f.read()

    creator.create_task(args=["v3-041", "Fix the roof", "No leaks, sealed tiles", 4, "", LOC, ""]).transact()
    worker.join_job(args=["v3-041"]).transact()
    creator.approve_worker(args=["v3-041"]).transact()
    worker.submit_proof(args=["v3-041", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v3-041"]).transact()
    tx = creator.resolve_task(args=["v3-041", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-041"]).call()["status"] == "REJECTED"

    stranger = _as(creator)
    tx = stranger.refund(args=["v3-041"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.refund(args=["v3-041"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-041"]).call()["status"] == "REFUNDED"
    before, after = _load_images()
    tx = worker.appeal(args=["v3-041", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)


@pytest.mark.slow
def test_appeal_cap_enforced_after_second_reject():
    """Spend the single appeal, get rejected again, the cap branch fires."""
    creator = _deploy()
    worker = _as(creator)
    with open(os.path.join(FIXTURES, "unrelated.png"), "rb") as f:
        unrelated = f.read()

    creator.create_task(args=["v3-042", "Repaint the wall", "Clean light blue paint", 2, "", LOC, ""]).transact()
    worker.join_job(args=["v3-042"]).transact()
    creator.approve_worker(args=["v3-042"]).transact()
    worker.submit_proof(args=["v3-042", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v3-042"]).transact()
    tx = creator.resolve_task(args=["v3-042", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v3-042"]).call()["status"] == "REJECTED"

    worker.appeal(args=["v3-042", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v3-042"]).transact()
    tx = creator.resolve_task(args=["v3-042", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v3-042"]).call()
    assert task["status"] == "REJECTED"
    assert task["appeals_used"] == "1"
    tx = worker.appeal(args=["v3-042", _sha(unrelated), _sha(unrelated)]).transact()
    assert tx_execution_failed(tx)
