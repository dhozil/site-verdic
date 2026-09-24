"use client";

import { useState } from "react";
import type { TxUpdate } from "@/lib/genlayer";

const PHASES = ["signed", "accepted", "finalized"] as const;

export default function TxBanner({ update }: { update: TxUpdate | null }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  if (!update) return null;

  const phaseIndex = update.phase ? PHASES.indexOf(update.phase) : -1;

  async function copyHash() {
    if (!update?.hash) return;
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(update.hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  return (
    <div
      role="status"
      className={`mt-5 rounded-md border border-line bg-card px-4 py-3 ${
        update.isError ? "border-l-[6px] border-l-bad" : "border-l-[6px] border-l-brand"
      }`}
    >
      <p className="mt-0">{update.message}</p>
      {phaseIndex >= 0 && !update.isError && (
        <ol className="mt-2 flex flex-wrap gap-2" aria-label="Transaction progress">
          {PHASES.map((p, i) => (
            <li
              key={p}
              aria-current={i === phaseIndex ? "step" : undefined}
              className={`rounded px-2 py-0.5 text-sm font-bold ${
                i <= phaseIndex ? "bg-ink text-paper" : "bg-paper text-muted"
              }`}
            >
              {p}
            </li>
          ))}
        </ol>
      )}
      {update.consensus && (update.consensus.leadersTotal > 0 || update.consensus.validatorsTotal > 0) && (
        <p className="mt-2 text-sm text-muted">
          Consensus: {update.consensus.leadersOk} of {update.consensus.leadersTotal} leader
          runs succeeded
          {update.consensus.leadersTotal > update.consensus.leadersOk ? " (rotation recovered a failure)" : ""}
          ; {update.consensus.validatorsOk} of {update.consensus.validatorsTotal} validators
          agreed.
        </p>
      )}
      {update.hash && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <code className="break-all">{update.hash}</code>
          <button
            type="button"
            onClick={copyHash}
            className="min-h-[44px] rounded-md border border-ink bg-transparent px-3 font-semibold"
          >
            {copied ? "Copied" : "Copy hash"}
          </button>
          <a
            href={`https://explorer-studio.genlayer.com/tx/${update.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block min-h-[44px] rounded-md border border-ink px-3 py-2.5 font-semibold"
          >
            View in explorer
          </a>
        </p>
      )}
      {copyFailed && (
        <p className="mt-2 text-sm text-bad">
          Copy failed in this browser. Select the hash above manually.
        </p>
      )}
    </div>
  );
}
