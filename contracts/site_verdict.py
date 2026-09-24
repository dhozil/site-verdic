# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import hashlib
import json
import typing

ERROR_EXPECTED = "[EXPECTED]"
ERROR_LLM = "[LLM_ERROR]"

EMPTY_WORKER = Address("0x0000000000000000000000000000000000000000")

# Status lifecycle (v3):
# OPEN -> APPLIED -> ASSIGNED -> SUBMITTED -> CONFIRMED -> APPROVED -> PAID
#          (join)    (approve)                              \---> REJECTED -> SUBMITTED (appeal, 1x, worker only)
# APPLIED -> OPEN (creator reject_join / worker cancel_join)
# OPEN/APPLIED/ASSIGNED/SUBMITTED -> CANCELLED (creator, pre-confirm recovery)
# REJECTED -> REFUNDED (creator)
# Terminal: PAID, REFUNDED, CANCELLED.


@allow_storage
@dataclass
class Task:
    creator: Address
    worker: Address
    description: str
    requirements: str
    reward_atto: u256
    status: str
    proof_hash: str
    verdict_json: str
    appeals_used: u256
    before_hash: str
    baseline_hash: str
    location: str
    reference_url: str


def _parse_verdict(raw: typing.Any) -> dict:
    if not isinstance(raw, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} Non-dict verdict: {type(raw)}")
    approved = raw.get("approved")
    if approved is None:
        for alt in ("passed", "pass", "verified", "success"):
            if alt in raw:
                approved = raw[alt]
                break
    if approved is None:
        raise gl.vm.UserError(f"{ERROR_LLM} Missing 'approved'. Keys: {list(raw.keys())}")
    if isinstance(approved, str):
        approved = approved.strip().lower() in ("true", "1", "yes", "pass", "approved")
    confidence = raw.get("confidence", 0)
    try:
        confidence = int(round(float(str(confidence).strip())))
    except (ValueError, TypeError):
        confidence = 0
    confidence = max(0, min(100, confidence))
    reasoning = str(raw.get("reasoning", raw.get("analysis", "")))
    return {"approved": bool(approved), "confidence": confidence, "reasoning": reasoning}


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _handle_leader_error(leaders_res: gl.vm.Result, leader_fn) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        validator_msg = e.message if hasattr(e, "message") else str(e)
        if validator_msg.startswith(ERROR_EXPECTED):
            return validator_msg == leader_msg
        return False
    except Exception:
        return False


class SiteVerdict(gl.Contract):
    owner: Address
    tasks: TreeMap[str, Task]
    task_order: DynArray[str]
    evidence_history: TreeMap[str, str]

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write
    def create_task(
        self,
        task_id: str,
        description: str,
        requirements: str,
        reward_atto: u256,
        baseline_hash: str,
        location: str,
        reference_url: str,
    ) -> None:
        if not task_id or not description:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task_id and description required")
        if not location:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} site location required")
        if task_id in self.tasks:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task_id already exists")
        if reference_url and not (
            reference_url.startswith("http://") or reference_url.startswith("https://")
        ):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} reference_url must be http(s)")
        # NOTE: v1 accounting only. TODO: make payable + real escrow with gl.message.value.
        self.tasks[task_id] = Task(
            creator=gl.message.sender_address,
            worker=EMPTY_WORKER,
            description=description,
            requirements=requirements,
            reward_atto=reward_atto,
            status="OPEN",
            proof_hash="",
            verdict_json="",
            appeals_used=u256(0),
            before_hash="",
            baseline_hash=baseline_hash,
            location=location,
            reference_url=reference_url,
        )
        self.task_order.append(task_id)

    def _get(self, task_id: str) -> Task:
        if task_id not in self.tasks:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task not found")
        return self.tasks[task_id]

    def _save(self, task_id: str, task: Task) -> None:
        self.tasks[task_id] = task

    def _record(self, task_id: str, entry: dict) -> None:
        raw = str(self.evidence_history[task_id]) if task_id in self.evidence_history else "[]"
        try:
            history = json.loads(raw)
        except Exception:
            history = []
        history.append(entry)
        self.evidence_history[task_id] = json.dumps(history)

    def _history(self, task_id: str) -> list:
        if task_id not in self.evidence_history:
            return []
        try:
            return json.loads(str(self.evidence_history[task_id]))
        except Exception:
            return []

    @gl.public.write
    def join_job(self, task_id: str) -> None:
        task = self._get(task_id)
        if task.status != "OPEN":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} job not open for joining")
        if gl.message.sender_address == task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} creator cannot take own job")
        task.worker = gl.message.sender_address
        task.status = "APPLIED"
        self._save(task_id, task)

    @gl.public.write
    def approve_worker(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only creator can approve a worker")
        if task.status != "APPLIED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} no application to approve")
        task.status = "ASSIGNED"
        self._save(task_id, task)

    @gl.public.write
    def reject_join(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only creator can reject an application")
        if task.status != "APPLIED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} no application to reject")
        task.status = "OPEN"
        task.worker = EMPTY_WORKER
        self._save(task_id, task)

    @gl.public.write
    def cancel_join(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only applicant can cancel application")
        if task.status != "APPLIED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} no application to cancel")
        task.status = "OPEN"
        task.worker = EMPTY_WORKER
        self._save(task_id, task)

    @gl.public.write
    def submit_proof(self, task_id: str, proof_hash: str, before_hash: str) -> None:
        task = self._get(task_id)
        if task.status != "ASSIGNED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} join and get approved before submitting proof")
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only assigned worker can submit proof")
        if not proof_hash or not before_hash:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} proof_hash and before_hash required")
        # Split evidence across parties: a creator-attested baseline binds the
        # worker's before photo, so one party cannot install both sides alone.
        baseline = str(task.baseline_hash)
        if baseline and before_hash != baseline:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} before photo does not match creator baseline")
        task.worker = gl.message.sender_address
        task.proof_hash = proof_hash
        task.before_hash = before_hash
        task.status = "SUBMITTED"
        self._save(task_id, task)

    @gl.public.write
    def confirm_evidence(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only creator can confirm evidence")
        if task.status != "SUBMITTED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing submitted to confirm")
        task.status = "CONFIRMED"
        self._save(task_id, task)

    @gl.public.write
    def reject_submission(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only creator can reject a submission")
        if task.status != "SUBMITTED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing submitted to reject")
        task.status = "ASSIGNED"
        task.proof_hash = ""
        task.before_hash = ""
        self._save(task_id, task)

    @gl.public.write
    def retract_proof(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only worker can retract proof")
        if task.status != "SUBMITTED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing submitted to retract")
        task.status = "ASSIGNED"
        task.proof_hash = ""
        task.before_hash = ""
        self._save(task_id, task)

    @gl.public.write
    def cancel_task(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only creator can cancel")
        if task.status not in ("OPEN", "APPLIED", "ASSIGNED", "SUBMITTED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} cannot cancel in status " + task.status)
        task.status = "CANCELLED"
        self._save(task_id, task)

    @gl.public.write
    def resolve_task(self, task_id: str, before_image: bytes, after_image: bytes) -> None:
        task = self._get(task_id)
        if task.status != "CONFIRMED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evidence must be creator-confirmed first")
        if not before_image or len(before_image) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} before_image required")
        if not after_image or len(after_image) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} after_image required")
        # Bind the judged bytes to the committed hashes. Validators re-run this
        # check inside leader_fn, so swapped or substituted photos fail consensus.
        exp_before = str(task.before_hash)
        exp_after = str(task.proof_hash)
        mem_desc = str(task.description)
        mem_req = str(task.requirements)

        def leader_fn() -> dict:
            if _sha256_hex(bytes(before_image)) != exp_before:
                raise gl.vm.UserError(f"{ERROR_EXPECTED} before_image does not match committed hash")
            if _sha256_hex(bytes(after_image)) != exp_after:
                raise gl.vm.UserError(f"{ERROR_EXPECTED} after_image does not match committed hash")
            prompt = (
                "You are a strict construction/renovation inspector. Two photos given: BEFORE then AFTER.\n"
                f"Task: {mem_desc}\nRequirements: {mem_req}\n"
                "Approve ONLY if: same location in both photos, visible progress matching requirements, "
                "work looks complete (e.g. painted wall, installed tiles, repaired roof). "
                "Reject if different locations, no visible change, blurry/unrelated photos. "
                'Respond ONLY JSON: {"approved": true/false, "confidence": 0-100, "reasoning": "..."}'
            )
            raw = gl.nondet.exec_prompt(prompt, images=[before_image, after_image], response_format="json")
            if isinstance(raw, str):
                first = raw.find("{")
                last = raw.rfind("}")
                if first == -1 or last == -1:
                    raise gl.vm.UserError(f"{ERROR_LLM} LLM returned non-JSON")
                raw = json.loads(raw[first : last + 1])
            return _parse_verdict(raw)

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            try:
                mine = leader_fn()
            except Exception:
                return False
            leader_data = leaders_res.calldata
            if not isinstance(leader_data, dict) or "approved" not in leader_data:
                return False
            # Reasoning is display-only: never compared, never drives state.
            if bool(leader_data["approved"]) != bool(mine["approved"]):
                return False
            try:
                diff = abs(int(leader_data.get("confidence", 0)) - int(mine.get("confidence", 0)))
            except (ValueError, TypeError):
                return False
            return diff <= 15

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        task.status = "APPROVED" if result["approved"] else "REJECTED"
        task.verdict_json = json.dumps(result)
        self._record(task_id, {"proof_hash": exp_after, "before_hash": exp_before, "verdict": result})
        self._save(task_id, task)

    @gl.public.write
    def claim_reward(self, task_id: str) -> None:
        task = self._get(task_id)
        if task.status != "APPROVED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} task not approved")
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only worker can claim")
        task.status = "PAID"
        self._save(task_id, task)

    @gl.public.write
    def refund(self, task_id: str) -> None:
        task = self._get(task_id)
        if gl.message.sender_address != task.creator:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only creator can refund")
        if task.status != "REJECTED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} cannot refund in status " + task.status)
        task.status = "REFUNDED"
        self._save(task_id, task)

    @gl.public.write
    def appeal(self, task_id: str, proof_hash: str, before_hash: str) -> None:
        task = self._get(task_id)
        if task.status != "REJECTED":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only rejected tasks can be appealed")
        if gl.message.sender_address != task.worker:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only worker can appeal")
        if task.appeals_used >= u256(1):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} appeal already used")
        if not proof_hash or not before_hash:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} proof_hash and before_hash required")
        baseline = str(task.baseline_hash)
        if baseline and before_hash != baseline:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} before photo does not match creator baseline")
        task.appeals_used = task.appeals_used + u256(1)
        task.proof_hash = proof_hash
        task.before_hash = before_hash
        task.verdict_json = ""
        task.status = "SUBMITTED"
        self._save(task_id, task)

    @gl.public.view
    def get_task(self, task_id: str) -> dict:
        t = self._get(task_id)
        return {
            "creator": t.creator.as_hex,
            "worker": t.worker.as_hex,
            "description": t.description,
            "requirements": t.requirements,
            "reward_atto": str(t.reward_atto),
            "status": t.status,
            "proof_hash": t.proof_hash,
            "before_hash": t.before_hash,
            "baseline_hash": t.baseline_hash,
            "location": t.location,
            "reference_url": t.reference_url,
            "verdict": t.verdict_json,
            "appeals_used": str(t.appeals_used),
            "evidence_history": self._history(task_id),
        }

    @gl.public.view
    def list_tasks(self) -> list:
        return list(self.task_order)
