"""Integration tests for SiteVerdict v2 (staff-review hardened).

Three roles: creator posts, a DIFFERENT worker submits (the creator can never
take its own job), a stranger attacks. Adversarial paths: auth guards,
dual-confirm gate, hash binding, baseline binding, one-time settlement,
recovery transitions, wrong-state guards, appeal cap.

Run: gltest tests/integration/test_work_verifier.py -v -s --network studionet
"""

import hashlib
import os

import pytest

from gltest import get_contract_factory
from gltest.accounts import create_account
from gltest.assertions import tx_execution_succeeded, tx_execution_failed

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "fixtures")


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


def test_submit_confirm_flow():
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()

    tx = creator.create_task(
        args=["v2-001", "Repaint the wall", "Two coats light blue", 5, _sha(before)]
    ).transact()
    assert tx_execution_succeeded(tx)

    # The creator can never take its own job.
    tx = creator.submit_proof(args=["v2-001", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)

    # Baseline binding: wrong before hash rejected at submit.
    tx = worker.submit_proof(args=["v2-001", _sha(after), _sha(b"nope")]).transact()
    assert tx_execution_failed(tx)

    tx = worker.submit_proof(args=["v2-001", _sha(after), _sha(before)]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-001"]).call()["status"] == "SUBMITTED"

    # Resolve blocked before creator confirmation (dual-confirm gate).
    tx = creator.resolve_task(args=["v2-001", before, after]).transact()
    assert tx_execution_failed(tx)

    # Only the creator can confirm.
    stranger = _as(creator)
    tx = stranger.confirm_evidence(args=["v2-001"]).transact()
    assert tx_execution_failed(tx)

    tx = creator.confirm_evidence(args=["v2-001"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-001"]).call()["status"] == "CONFIRMED"


def test_recovery_transitions():
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()

    # Worker retracts own submission; stranger cannot retract.
    creator.create_task(args=["v2-010", "Tiles", "Even grout lines", 3, ""]).transact()
    worker.submit_proof(args=["v2-010", _sha(after), _sha(before)]).transact()
    stranger = _as(creator)
    tx = stranger.retract_proof(args=["v2-010"]).transact()
    assert tx_execution_failed(tx)
    tx = worker.retract_proof(args=["v2-010"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-010"]).call()["status"] == "OPEN"

    # Creator rejects a submission; stranger cannot.
    worker.submit_proof(args=["v2-010", _sha(after), _sha(before)]).transact()
    tx = stranger.reject_submission(args=["v2-010"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.reject_submission(args=["v2-010"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-010"]).call()["status"] == "OPEN"

    # Creator cancels pre-confirm; stranger cannot cancel.
    tx = stranger.cancel_task(args=["v2-010"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.cancel_task(args=["v2-010"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-010"]).call()["status"] == "CANCELLED"

    # Terminal: no submit after cancel.
    tx = worker.submit_proof(args=["v2-010", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)


def test_wrong_state_guards():
    """Every method rejects calls made in the wrong state."""
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()
    creator.create_task(args=["v2-050", "Paint", "Even coats", 2, ""]).transact()

    # Nothing submitted yet: resolve/confirm/claim/retract/reject/appeal/refund fail.
    assert tx_execution_failed(creator.resolve_task(args=["v2-050", before, after]).transact())
    assert tx_execution_failed(creator.confirm_evidence(args=["v2-050"]).transact())
    assert tx_execution_failed(worker.claim_reward(args=["v2-050"]).transact())
    assert tx_execution_failed(worker.retract_proof(args=["v2-050"]).transact())
    assert tx_execution_failed(creator.reject_submission(args=["v2-050"]).transact())
    assert tx_execution_failed(worker.appeal(args=["v2-050", _sha(after), _sha(before)]).transact())
    assert tx_execution_failed(creator.refund(args=["v2-050"]).transact())

    # Unknown task id fails on write and view.
    assert tx_execution_failed(worker.submit_proof(args=["nope", "a", "b"]).transact())
    try:
        creator.get_task(args=["nope"]).call()
        raised = False
    except Exception:
        raised = True
    assert raised

    # Double submit blocked; cancel/retract/reject blocked once CONFIRMED.
    worker.submit_proof(args=["v2-050", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(worker.submit_proof(args=["v2-050", _sha(after), _sha(before)]).transact())
    creator.confirm_evidence(args=["v2-050"]).transact()
    assert tx_execution_failed(creator.cancel_task(args=["v2-050"]).transact())
    assert tx_execution_failed(worker.retract_proof(args=["v2-050"]).transact())
    assert tx_execution_failed(creator.reject_submission(args=["v2-050"]).transact())


@pytest.mark.slow
def test_hash_binding_rejects_substituted_bytes():
    """Committed hashes, confirmed, but resolve called with different bytes."""
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()

    creator.create_task(args=["v2-020", "Repaint the wall", "Clean blue, white trim", 5, ""]).transact()
    worker.submit_proof(args=["v2-020", _sha(after), _sha(before)]).transact()
    creator.confirm_evidence(args=["v2-020"]).transact()

    tampered = b"not the committed photo" + after
    tx = creator.resolve_task(args=["v2-020", before, tampered]).transact()
    assert tx_execution_failed(tx)
    # State untouched by the failed resolve.
    assert creator.get_task(args=["v2-020"]).call()["status"] == "CONFIRMED"


@pytest.mark.slow
def test_full_approve_settles_once():
    creator = _deploy()
    worker = _as(creator)
    before, after = _load_images()

    creator.create_task(
        args=["v2-030", "Repaint the living room wall", "Wall painted clean light blue, neat white trim", 5, _sha(before)]
    ).transact()
    worker.submit_proof(args=["v2-030", _sha(after), _sha(before)]).transact()
    creator.confirm_evidence(args=["v2-030"]).transact()

    tx = creator.resolve_task(args=["v2-030", before, after]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v2-030"]).call()
    print("VERDICT:", task["verdict"])
    if task["status"] == "REJECTED":
        # One appeal retry: vision verdicts can flip run to run.
        tx = worker.appeal(args=["v2-030", _sha(after), _sha(before)]).transact()
        assert tx_execution_succeeded(tx)
        creator.confirm_evidence(args=["v2-030"]).transact()
        tx = creator.resolve_task(args=["v2-030", before, after]).transact()
        assert tx_execution_succeeded(tx)
        task = creator.get_task(args=["v2-030"]).call()
        print("RETRY:", task["verdict"])
    assert task["status"] == "APPROVED"
    assert task["worker"] != task["creator"]
    assert len(task["evidence_history"]) == 1

    # Stranger cannot claim; worker claims once; second claim fails.
    stranger = _as(creator)
    tx = stranger.claim_reward(args=["v2-030"]).transact()
    assert tx_execution_failed(tx)
    tx = worker.claim_reward(args=["v2-030"]).transact()
    assert tx_execution_succeeded(tx)
    tx = worker.claim_reward(args=["v2-030"]).transact()
    assert tx_execution_failed(tx)
    assert creator.get_task(args=["v2-030"]).call()["status"] == "PAID"

    # No refund after payout.
    tx = creator.refund(args=["v2-030"]).transact()
    assert tx_execution_failed(tx)


@pytest.mark.slow
def test_garbage_pair_rejected_then_worker_only_appeal():
    creator = _deploy()
    worker = _as(creator)
    with open(os.path.join(FIXTURES, "unrelated.png"), "rb") as f:
        unrelated = f.read()

    creator.create_task(args=["v2-040", "Repaint the wall", "Clean light blue paint, neat white trim", 4, ""]).transact()
    worker.submit_proof(
        args=["v2-040", _sha(unrelated), _sha(unrelated)]
    ).transact()
    creator.confirm_evidence(args=["v2-040"]).transact()

    tx = creator.resolve_task(args=["v2-040", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v2-040"]).call()
    print("VERDICT:", task["verdict"])
    assert task["status"] == "REJECTED"

    # Appeal is worker-only and single-use: creator and stranger both fail.
    stranger = _as(creator)
    before, after = _load_images()
    tx = stranger.appeal(args=["v2-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)
    tx = creator.appeal(args=["v2-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)
    tx = worker.appeal(args=["v2-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v2-040"]).call()
    assert task["status"] == "SUBMITTED"
    assert task["appeals_used"] == "1"
    # Second appeal attempt fails (wrong status: needs re-confirm + re-resolve).
    tx = worker.appeal(args=["v2-040", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)

    # Stranger cannot refund a rejected job.
    tx = stranger.refund(args=["v2-040"]).transact()
    assert tx_execution_failed(tx)

    # Appeal recovery: confirm + resolve the real pair -> APPROVED, and
    # history preserves both rounds.
    tx = creator.confirm_evidence(args=["v2-040"]).transact()
    assert tx_execution_succeeded(tx)
    tx = creator.resolve_task(args=["v2-040", before, after]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v2-040"]).call()
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

    creator.create_task(args=["v2-041", "Fix the roof", "No leaks, sealed tiles", 4, ""]).transact()
    worker.submit_proof(args=["v2-041", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v2-041"]).transact()
    tx = creator.resolve_task(args=["v2-041", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-041"]).call()["status"] == "REJECTED"

    stranger = _as(creator)
    tx = stranger.refund(args=["v2-041"]).transact()
    assert tx_execution_failed(tx)
    tx = creator.refund(args=["v2-041"]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-041"]).call()["status"] == "REFUNDED"
    # Terminal: no appeal after refund.
    before, after = _load_images()
    tx = worker.appeal(args=["v2-041", _sha(after), _sha(before)]).transact()
    assert tx_execution_failed(tx)


@pytest.mark.slow
def test_appeal_cap_enforced_after_second_reject():
    """Spend the single appeal, get rejected again, the cap branch fires."""
    creator = _deploy()
    worker = _as(creator)
    with open(os.path.join(FIXTURES, "unrelated.png"), "rb") as f:
        unrelated = f.read()

    creator.create_task(args=["v2-042", "Repaint the wall", "Clean light blue paint", 2, ""]).transact()
    worker.submit_proof(args=["v2-042", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v2-042"]).transact()
    tx = creator.resolve_task(args=["v2-042", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["v2-042"]).call()["status"] == "REJECTED"

    worker.appeal(args=["v2-042", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["v2-042"]).transact()
    tx = creator.resolve_task(args=["v2-042", unrelated, unrelated]).transact()
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["v2-042"]).call()
    assert task["status"] == "REJECTED"
    assert task["appeals_used"] == "1"
    # Status allows an appeal, but the single appeal is spent: cap branch.
    tx = worker.appeal(args=["v2-042", _sha(unrelated), _sha(unrelated)]).transact()
    assert tx_execution_failed(tx)
