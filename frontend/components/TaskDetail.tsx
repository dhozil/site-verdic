"use client";

import { useRef, useState } from "react";
import CompareSlider from "@/components/CompareSlider";
import StatusPipeline from "@/components/StatusPipeline";
import { openReceipt } from "@/components/Receipt";
import {
  formatGen,
  readTask,
  sendWrite,
  sha256Hex,
  shortAddr,
  type TaskView,
  type TxUpdate,
} from "@/lib/genlayer";
import { compressPhoto } from "@/lib/images";
import { friendlyTransport } from "@/lib/errors";
import type { WalletProvider } from "@/lib/wallets";

interface Props {
  task: TaskView;
  account: string | null;
  provider: WalletProvider | null;
  onTx: (update: TxUpdate | null) => void;
  onChanged: (id: string) => void;
}

function statusClass(status: string): string {
  if (status === "APPROVED" || status === "PAID") return "text-ok";
  if (status === "REJECTED" || status === "REFUNDED" || status === "CANCELLED") return "text-bad";
  if (["SUBMITTED", "CONFIRMED", "APPLIED", "ASSIGNED"].includes(status)) return "text-brand-deep";
  return "text-ink";
}

export default function TaskDetail({ task, account, provider, onTx, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [previewBefore, setPreviewBefore] = useState<string | null>(null);
  const [previewAfter, setPreviewAfter] = useState<string | null>(null);
  const [matchBefore, setMatchBefore] = useState<boolean | null>(null);
  const [matchAfter, setMatchAfter] = useState<boolean | null>(null);
  const [linkState, setLinkState] = useState<"idle" | "copied" | "failed">("idle");
  const [refBroken, setRefBroken] = useState(false);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);

  const same = (a: string, b: string | null) =>
    !!b && a.toLowerCase() === b.toLowerCase();
  const isCreator = same(task.creator, account);
  const isWorker = task.worker !== "" && same(task.worker, account);

  async function selectedBytes(): Promise<{
    before: Uint8Array;
    after: Uint8Array;
    beforeBuf: ArrayBuffer;
    afterBuf: ArrayBuffer;
  } | null> {
    const fb = beforeRef.current?.files?.[0];
    const fa = afterRef.current?.files?.[0];
    if (!fb || !fa) {
      onTx({ message: "Select the before and after photos first.", isError: true });
      return null;
    }
    try {
      const before = await compressPhoto(fb);
      const after = await compressPhoto(fa);
      return {
        before: before.bytes,
        after: after.bytes,
        beforeBuf: before.buffer,
        afterBuf: after.buffer,
      };
    } catch (err) {
      onTx({
        message: err instanceof Error ? err.message : "Could not process the photos.",
        isError: true,
      });
      return null;
    }
  }

  async function run(label: string, fn: (active: WalletProvider, user: string) => Promise<void>) {
    const active = provider;
    const user = account;
    if (!user || !active) {
      onTx({ message: `Connect a wallet before ${label}.`, isError: true });
      return;
    }
    setBusy(true);
    try {
      await fn(active, user);
      onChanged(task.id);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message !== "files missing" &&
        err.message !== "no consensus" &&
        !err.message.startsWith("execution failed")
      ) {
        onTx({ message: friendlyTransport(err, "Action failed."), isError: true });
      }
      /* reported errors pass through silently */
    } finally {
      setBusy(false);
    }
  }

  const join = () =>
    run("joining this job", (active, user) => sendWrite(active, user, "join_job", [task.id], onTx));
  const approveWorker = () =>
    run("approving the worker", (active, user) =>
      sendWrite(active, user, "approve_worker", [task.id], onTx),
    );
  const rejectJoin = () =>
    run("rejecting the application", (active, user) =>
      sendWrite(active, user, "reject_join", [task.id], onTx),
    );
  const cancelJoin = () =>
    run("cancelling the application", (active, user) =>
      sendWrite(active, user, "cancel_join", [task.id], onTx),
    );

  const submitProof = () =>
    run("submitting proof", async (active, user) => {
      const files = await selectedBytes();
      if (!files) throw new Error("files missing");
      const beforeHash = await sha256Hex(files.beforeBuf);
      const afterHash = await sha256Hex(files.afterBuf);
      if (task.status === "REJECTED") {
        await sendWrite(active, user, "appeal", [task.id, afterHash, beforeHash], onTx);
      } else {
        await sendWrite(active, user, "submit_proof", [task.id, afterHash, beforeHash], onTx);
      }
    });

  const resolve = () =>
    run("requesting verification", async (active, user) => {
      if (matchBefore === false || matchAfter === false) {
        onTx({
          message:
            "The selected files differ from the committed evidence (see the notes under each file). Re-select the exact files used at submit time.",
          isError: true,
        });
        throw new Error("files missing");
      }
      const files = await selectedBytes();
      if (!files) {
        onTx({
          message: "Select both verification photos above first.",
          isError: true,
        });
        throw new Error("files missing");
      }
      await sendWrite(active, user, "resolve_task", [task.id, files.before, files.after], onTx);
      const fresh = await readTask(task.id);
      if (fresh.status === "CONFIRMED") {
        onTx({
          message:
            "Finalized, but validators did not agree, so the status did not change. Wait a moment and press Request AI Verification again.",
          isError: true,
        });
        throw new Error("no consensus");
      }
    });

  const confirm = () =>
    run("confirming evidence", (active, user) => sendWrite(active, user, "confirm_evidence", [task.id], onTx));
  const rejectSubmission = () =>
    run("rejecting the submission", (active, user) =>
      sendWrite(active, user, "reject_submission", [task.id], onTx),
    );
  const retract = () =>
    run("retracting proof", (active, user) => sendWrite(active, user, "retract_proof", [task.id], onTx));
  const cancel = () =>
    run("cancelling the job", (active, user) => sendWrite(active, user, "cancel_task", [task.id], onTx));
  const claim = () =>
    run("claiming the wage", (active, user) => sendWrite(active, user, "claim_reward", [task.id], onTx));
  const refund = () =>
    run("withdrawing", (active, user) => sendWrite(active, user, "refund", [task.id], onTx));

  let verdict: { approved?: boolean; confidence?: number; reasoning?: string } | null = null;
  try {
    verdict = task.verdict ? JSON.parse(task.verdict) : null;
  } catch {
    verdict = null;
  }

  const showProofForm =
    ((task.status === "ASSIGNED" || task.status === "REJECTED") && isWorker) ||
    (task.status === "REJECTED" && !account);

  function nextStep(): string | null {
    switch (task.status) {
      case "OPEN":
        return isCreator
          ? "Next: wait for a worker to press Join Job."
          : "Next: press Join Job, then wait for the client to approve you.";
      case "APPLIED":
        if (isCreator) return "Next: review the applicant, then Approve Worker or Reject Join.";
        if (isWorker) return "Next: nothing. The client must approve your application.";
        return "Next: the client must approve the pending application.";
      case "ASSIGNED":
        return isWorker
          ? "Next: do the work, then submit the before and after photos below."
          : "Next: the assigned worker submits photo proof.";
      case "SUBMITTED":
        if (isCreator) return "Next: check the submitted hashes, then Confirm Evidence or Reject Submission.";
        if (isWorker) return "Next: nothing. The client must confirm your evidence before verification.";
        return "Next: the client must confirm the submitted evidence.";
      case "CONFIRMED":
        return "Next: run Request AI Verification with the exact photo files that were hashed.";
      case "APPROVED":
        return isWorker
          ? "Next: press Claim Wage to settle."
          : "Next: the worker claims the wage.";
      case "REJECTED":
        if (isWorker && task.appeals_used === "0")
          return "Next: file one appeal with a better photo pair, or leave it for the client to refund.";
        if (isCreator) return "Next: refund the job, or wait for the worker appeal.";
        return "Terminal unless the worker appeals.";
      case "PAID":
        return "Settled. The wage was claimed by the worker.";
      case "REFUNDED":
        return "Settled. The job was refunded to the client.";
      case "CANCELLED":
        return "Settled. The client cancelled before confirmation.";
      default:
        return null;
    }
  }
  const hint = nextStep();

  function trackFile(
    input: HTMLInputElement | null,
    setPreview: React.Dispatch<React.SetStateAction<string | null>>,
    setMatch: React.Dispatch<React.SetStateAction<boolean | null>>,
    expectedHash: string,
  ) {
    const file = input?.files?.[0] ?? null;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    // Pre-check the file against the committed hash so a mismatch is caught
    // here, not as a failed on-chain transaction.
    if (!file || !expectedHash) {
      setMatch(null);
      return;
    }
    setMatch(null);
    void (async () => {
      try {
        const compressed = await compressPhoto(file);
        const digest = await sha256Hex(compressed.buffer);
        setMatch(digest.toLowerCase() === expectedHash.toLowerCase());
      } catch {
        setMatch(null);
      }
    })();
  }

  function matchNote(match: boolean | null): React.ReactNode {
    if (match === null) return null;
    return match ? (
      <span className="text-sm font-bold text-ok">Matches the committed evidence.</span>
    ) : (
      <span className="text-sm font-bold text-bad">
        Differs from the committed evidence. Resolving with this file will fail; re-select the exact file used at submit time.
      </span>
    );
  }

  function fileInputs(expectedBefore: string, expectedAfter: string) {
    return (
      <>
        <label className="grid gap-1 font-semibold">
          Before photo
          <input
            ref={beforeRef}
            type="file"
            accept="image/png,image/jpeg"
            required
            onChange={(e) => trackFile(e.currentTarget, setPreviewBefore, setMatchBefore, expectedBefore)}
            className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
          />
          {matchNote(matchBefore)}
        </label>
        <label className="grid gap-1 font-semibold">
          After photo
          <input
            ref={afterRef}
            type="file"
            accept="image/png,image/jpeg"
            required
            onChange={(e) => trackFile(e.currentTarget, setPreviewAfter, setMatchAfter, expectedAfter)}
            className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
          />
          {matchNote(matchAfter)}
        </label>
        {previewBefore && previewAfter && (
          <CompareSlider beforeUrl={previewBefore} afterUrl={previewAfter} />
        )}
      </>
    );
  }

  return (
    <section aria-labelledby="h-detail" className="mt-0">
      <div className="rounded-md bg-ink px-5 py-4 text-paper">
        <p className="text-sm text-paper/70">Work order</p>
        <h2 id="h-detail" className="font-sign break-all text-3xl font-semibold uppercase tracking-wide">
          {task.id}
        </h2>
        <p className="mt-1 text-paper/85">{task.location}</p>
        <StatusPipeline status={task.status} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/console?job=${encodeURIComponent(task.id)}`;
              try {
                await navigator.clipboard.writeText(url);
                setLinkState("copied");
                window.setTimeout(() => setLinkState("idle"), 2000);
              } catch {
                setLinkState("failed");
              }
            }}
            className="min-h-[44px] rounded-md border border-paper/60 bg-transparent px-3 text-sm font-semibold text-paper transition-colors hover:bg-paper/10"
          >
            {linkState === "copied" ? "Link copied" : "Copy job link"}
          </button>
          {linkState === "failed" && (
            <span className="text-sm text-brand">
              Copy failed. Copy the address bar URL with ?job={task.id} manually.
            </span>
          )}
        </div>
      </div>
      {hint && (
        <p className="mt-3 rounded-md border border-line border-l-[6px] border-l-brand bg-card px-4 py-3">
          {hint}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-[11rem_1fr] gap-x-4 gap-y-1.5 rounded-md border border-line border-t-4 border-t-brand bg-card px-4 py-3">
        <dt className="font-bold">Code</dt>
        <dd className="break-all">{task.id}</dd>
        <dt className="font-bold">Description</dt>
        <dd>{task.description}</dd>
        <dt className="font-bold">Acceptance criteria</dt>
        <dd>{task.requirements}</dd>
        <dt className="font-bold">Site location</dt>
        <dd>{task.location}</dd>
        <dt className="font-bold">Wage</dt>
        <dd>
          {formatGen(task.reward_atto)} GEN{" "}
          <span className="text-sm text-muted">({task.reward_atto} atto)</span>
        </dd>
        <dt className="font-bold">Status</dt>
        <dd className={`font-bold ${statusClass(task.status)}`}>{task.status}</dd>
        <dt className="font-bold">Client</dt>
        <dd>{shortAddr(task.creator)}</dd>
        <dt className="font-bold">Worker</dt>
        <dd>{task.worker ? shortAddr(task.worker) : "awaiting applications"}</dd>
        <dt className="font-bold">Baseline hash</dt>
        <dd className="break-all">{task.baseline_hash || "none committed"}</dd>
        <dt className="font-bold">Proof hash</dt>
        <dd className="break-all">{task.proof_hash || "none submitted"}</dd>
        <dt className="font-bold">Appeals used</dt>
        <dd>{task.appeals_used} of 1</dd>
      </dl>

      {task.reference_url && !refBroken && (
        <div className="mt-4">
          <h3 className="font-sign text-lg font-semibold uppercase tracking-wide">
            Site reference photo
          </h3>
          <p className="mt-0 text-sm text-muted">
            Provided by the client for orientation. Display only, not verified evidence.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.reference_url}
            alt={`Reference photo of the work site for ${task.id}`}
            onError={() => setRefBroken(true)}
            className="mt-2 max-h-80 w-full rounded-md border border-line object-cover"
          />
        </div>
      )}
      {task.reference_url && refBroken && (
        <p className="mt-4 rounded-md border border-line bg-card px-4 py-3 text-sm text-muted">
          The reference photo link no longer loads.
        </p>
      )}

      {task.status === "SUBMITTED" && (
        <p className="mt-3 rounded-md border border-line bg-card px-4 py-3">
          Evidence submitted and hash-committed. Resolution unlocks after the
          client confirms the evidence{isCreator ? "; use the buttons below." : "."}
        </p>
      )}

      {verdict && (
        <div
          className={`mt-4 rounded-md border border-line bg-card px-4 py-4 ${
            verdict.approved ? "border-l-[6px] border-l-ok" : "border-l-[6px] border-l-bad"
          }`}
        >
          <p className="font-sign text-2xl font-semibold uppercase tracking-wide">
            AI verdict: {verdict.approved ? "Approved" : "Rejected"}
          </p>
          <div
            className="mt-2 h-3 overflow-hidden rounded bg-paper"
            role="img"
            aria-label={`Validator confidence ${verdict.confidence} out of 100`}
          >
            <div
              className={`h-full ${verdict.approved ? "bg-ok" : "bg-bad"}`}
              style={{ width: `${verdict.confidence ?? 0}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-muted">
            Confidence {verdict.confidence}/100. Independent validators re-ran the same
            photo inspection against the committed hashes and agreed on this outcome.
          </p>
          <p className="mt-2">{verdict.reasoning ?? ""}</p>
        </div>
      )}

      {task.evidence_history.length > 0 && (
        <div className="mt-4">
          <h3 className="font-sign text-lg font-semibold uppercase tracking-wide">
            Evidence history ({task.evidence_history.length} rounds)
          </h3>
          <ol className="mt-2 grid gap-2">
            {task.evidence_history.map((entry, i) => (
              <li key={i} className="rounded-md border border-line bg-card px-4 py-3 text-sm">
                <p className="font-bold">
                  Round {i + 1}: {entry.verdict?.approved ? "Approved" : "Rejected"}
                  {typeof entry.verdict?.confidence === "number" &&
                    ` (${entry.verdict.confidence}/100)`}
                </p>
                <p className="mt-1 break-all text-muted">
                  after {entry.proof_hash}, before {entry.before_hash}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        {task.status === "OPEN" && !isCreator && (
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55"
          >
            Join Job
          </button>
        )}
        {task.status === "APPLIED" && isCreator && (
          <>
            <button
              type="button"
              onClick={approveWorker}
              disabled={busy}
              className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55"
            >
              Approve Worker
            </button>
            <button
              type="button"
              onClick={rejectJoin}
              disabled={busy}
              className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold disabled:cursor-wait disabled:opacity-55"
            >
              Reject Application
            </button>
          </>
        )}
        {task.status === "APPLIED" && isWorker && (
          <button
            type="button"
            onClick={cancelJoin}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold disabled:cursor-wait disabled:opacity-55"
          >
            Withdraw Application
          </button>
        )}
        {task.status === "CONFIRMED" && (
          <button
            type="button"
            onClick={resolve}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55"
          >
            Request AI Verification
          </button>
        )}
        {task.status === "APPROVED" && isWorker && (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55"
          >
            Claim Wage
          </button>
        )}
        {(task.status === "OPEN" ||
          task.status === "APPLIED" ||
          task.status === "ASSIGNED" ||
          task.status === "SUBMITTED") &&
          isCreator && (
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="min-h-[44px] rounded-md border border-bad bg-transparent px-4 font-semibold text-bad disabled:cursor-wait disabled:opacity-55"
            >
              Cancel Job
            </button>
          )}
        {task.status === "REJECTED" && isCreator && (
          <button
            type="button"
            onClick={refund}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold disabled:cursor-wait disabled:opacity-55"
          >
            Refund Job
          </button>
        )}
        {task.status === "SUBMITTED" && isCreator && (
          <>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55"
            >
              Confirm Evidence
            </button>
            <button
              type="button"
              onClick={rejectSubmission}
              disabled={busy}
              className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold disabled:cursor-wait disabled:opacity-55"
            >
              Reject Submission
            </button>
          </>
        )}
        {task.status === "CONFIRMED" && isCreator && (
          <button
            type="button"
            onClick={rejectSubmission}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold disabled:cursor-wait disabled:opacity-55"
          >
            Reject Submission
          </button>
        )}
        {(task.status === "SUBMITTED" || task.status === "CONFIRMED") && isWorker && (
          <button
            type="button"
            onClick={retract}
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold disabled:cursor-wait disabled:opacity-55"
          >
            Retract Proof
          </button>
        )}
        {task.status === "PAID" && (
          <button
            type="button"
            onClick={() => openReceipt(task)}
            className="min-h-[44px] rounded-md border border-ink bg-brand px-4 font-bold text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Download Receipt
          </button>
        )}
      </div>

      {showProofForm && (
        <form
          key={`submit-${task.id}`}
          onSubmit={(e) => {
            e.preventDefault();
            void submitProof();
          }}
          noValidate
          className="mt-4 grid gap-3 rounded-md border border-line bg-card p-4"
        >
          <h3 className="font-sign text-lg font-semibold uppercase tracking-wide">
            {task.status === "REJECTED" ? "Appeal with new photos" : "Submit photo proof"}
          </h3>
          <p className="mt-0">
            Pick photos of the same spot: the condition before and after the work.
            Photos are downscaled to 1280px in your browser before hashing.
            {task.baseline_hash &&
              " The before photo must hash to the client baseline."}
          </p>
          <ul className="list-disc pl-5 text-sm text-muted" aria-label="Photo tips for a stable verdict">
            <li>Shoot from the same angle and distance both times.</li>
            <li>Use good light and fill the frame with the work area.</li>
            <li>Show the finished criteria clearly, not the whole street.</li>
          </ul>
          {fileInputs(task.baseline_hash, "")}
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55"
          >
            {task.status === "REJECTED" ? "File Appeal" : "Submit Photo Proof"}
          </button>
        </form>
      )}

      {task.status === "CONFIRMED" && (
        <div key={`verify-${task.id}`} className="mt-4 grid gap-3 rounded-md border border-line bg-card p-4">
          <h3 className="font-sign text-lg font-semibold uppercase tracking-wide">
            Photos for verification
          </h3>
          <p className="mt-0">
            Select the exact photo files that were hashed at submit time. The
            contract rejects any bytes that do not match the committed hashes.
          </p>
          {fileInputs(task.before_hash, task.proof_hash)}
        </div>
      )}

      {(task.status === "OPEN" || task.status === "REJECTED") && isCreator && (
        <p className="mt-4 rounded-md border border-line bg-card px-4 py-3">
          You posted this job. A different wallet must join and submit the proof;
          the contract rejects self-submission.
        </p>
      )}
    </section>
  );
}
