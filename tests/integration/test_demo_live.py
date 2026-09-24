"""Live demo on the persistent deployment: full lifecycles + consensus introspection.

Run: gltest tests/integration/test_demo_live.py -v -s --network studionet
Leaves demo jobs on the deployed contract for the frontend showcase.
"""

import hashlib
import json
import os
import time

import pytest

from gltest import get_contract_factory
from gltest.accounts import create_account
from gltest.assertions import tx_execution_succeeded

DEPLOYED = "0x7c1326a0330c44Fb0815b2F9B6A8C3add015fBD1"
FIXTURES = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def _load(name):
    with open(os.path.join(FIXTURES, name), "rb") as f:
        return f.read()


def _sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _connect():
    factory = get_contract_factory("SiteVerdict")
    return factory.build_contract(contract_address=DEPLOYED)


def _as_other(contract):
    factory = get_contract_factory("SiteVerdict")
    return factory.build_contract(contract_address=contract.address, account=create_account())


def _consensus_summary(receipt, label):
    cd = receipt.get("consensus_data", {})
    leaders = cd.get("leader_receipt", [])
    vals = cd.get("validator_receipts", cd.get("validators", []))
    print(f"--- consensus [{label}] ---")
    print(f"leader receipts: {len(leaders)}")
    for i, lr in enumerate(leaders):
        print(f"  leader[{i}] exec={lr.get('execution_result')}")
    if isinstance(vals, list):
        print(f"validator receipts: {len(vals)}")
        for i, vr in enumerate(vals):
            if isinstance(vr, dict):
                print(f"  validator[{i}] exec={vr.get('execution_result')}")
    else:
        print(f"validator info: {str(vals)[:300]}")
    print(f"status: {receipt.get('status')}")


def _timed(label, fn):
    start = time.time()
    out = fn()
    print(f"[{label}] took {time.time() - start:.1f}s")
    return out


@pytest.mark.slow
def test_live_demo_approve_path():
    creator = _connect()
    worker = _as_other(creator)
    before, after = _load("before.png"), _load("after.png")

    _timed("create", lambda: creator.create_task(
        args=["demo-paint-03", "Repaint the site office wall",
              "Wall painted clean light blue, neat white trim", 10, _sha(before),
              "Jl. Merdeka No. 45, Bandung", ""]
    ).transact())

    tx = _timed("join-worker", lambda: worker.join_job(args=["demo-paint-03"]).transact())
    assert tx_execution_succeeded(tx)
    tx = _timed("approve", lambda: creator.approve_worker(args=["demo-paint-03"]).transact())
    assert tx_execution_succeeded(tx)

    tx = _timed("submit-worker", lambda: worker.submit_proof(
        args=["demo-paint-03", _sha(after), _sha(before)]).transact())
    assert tx_execution_succeeded(tx)

    tx = _timed("confirm", lambda: creator.confirm_evidence(args=["demo-paint-03"]).transact())
    assert tx_execution_succeeded(tx)

    tx = _timed("resolve-AI", lambda: creator.resolve_task(
        args=["demo-paint-03", before, after]).transact())
    assert tx_execution_succeeded(tx)
    _consensus_summary(tx, "resolve approve")
    task = creator.get_task(args=["demo-paint-03"]).call()
    print("VERDICT:", task["verdict"])
    assert task["status"] == "APPROVED"
    assert task["worker"] != task["creator"]

    tx = _timed("claim-worker", lambda: worker.claim_reward(args=["demo-paint-03"]).transact())
    assert tx_execution_succeeded(tx)
    assert creator.get_task(args=["demo-paint-03"]).call()["status"] == "PAID"
    print("demo-paint-03 settled PAID")


@pytest.mark.slow
def test_live_demo_reject_appeal_path():
    creator = _connect()
    worker = _as_other(creator)
    unrelated = _load("unrelated.png")
    before, after = _load("before.png"), _load("after.png")

    creator.create_task(
        args=["demo-roof-03", "Repaint the storage room wall",
              "Clean light blue paint, neat white trim", 7, "",
              "Jl. Merdeka No. 45, Bandung", ""]).transact()
    worker.join_job(args=["demo-roof-03"]).transact()
    creator.approve_worker(args=["demo-roof-03"]).transact()
    worker.submit_proof(args=["demo-roof-03", _sha(unrelated), _sha(unrelated)]).transact()
    creator.confirm_evidence(args=["demo-roof-03"]).transact()

    tx = _timed("resolve-AI-reject", lambda: creator.resolve_task(
        args=["demo-roof-03", unrelated, unrelated]).transact())
    assert tx_execution_succeeded(tx)
    _consensus_summary(tx, "resolve reject")
    task = creator.get_task(args=["demo-roof-03"]).call()
    print("VERDICT:", task["verdict"])
    assert task["status"] == "REJECTED"

    tx = _timed("appeal-worker", lambda: worker.appeal(
        args=["demo-roof-03", _sha(after), _sha(before)]).transact())
    assert tx_execution_succeeded(tx)
    creator.confirm_evidence(args=["demo-roof-03"]).transact()
    tx = _timed("resolve-AI-recovery", lambda: creator.resolve_task(
        args=["demo-roof-03", before, after]).transact())
    assert tx_execution_succeeded(tx)
    task = creator.get_task(args=["demo-roof-03"]).call()
    print("RECOVERED:", json.dumps(task["evidence_history"])[:400])
    assert task["status"] == "APPROVED"
    worker.claim_reward(args=["demo-roof-03"]).transact()
    assert creator.get_task(args=["demo-roof-03"]).call()["status"] == "PAID"
    print("demo-roof-03 settled PAID after appeal")
