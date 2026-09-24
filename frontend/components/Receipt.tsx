"use client";

import { CONTRACT_ADDRESS, NETWORK_NAME } from "@/lib/config";
import { getJobJournal } from "@/lib/journal";
import type { TaskView } from "@/lib/genlayer";

const EXPLORER = "https://explorer-studio.genlayer.com";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatChainTime(unixSeconds: number): string {
  try {
    return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(unixSeconds);
  }
}

export function openReceipt(task: TaskView): void {
  const journal = getJobJournal(task.id);
  let verdict: { approved?: boolean; confidence?: number; reasoning?: string } | null = null;
  try {
    verdict = task.verdict ? JSON.parse(task.verdict) : null;
  } catch {
    verdict = null;
  }

  const steps: { label: string; method: string }[] = [
    { label: "Job posted", method: "create_task" },
    { label: "Proof submitted", method: "submit_proof" },
    { label: "Evidence confirmed", method: "confirm_evidence" },
    { label: "AI verdict", method: "resolve_task" },
    { label: "Wage claimed", method: "claim_reward" },
  ];
  const claimHash = journal.claim_reward?.hash ?? "";
  const receiptNo = claimHash ? claimHash.slice(2, 14).toUpperCase() : task.id.toUpperCase();
  const issuedAt = journal.claim_reward?.at
    ? formatTime(journal.claim_reward.at)
    : formatTime(new Date().toISOString());

  const rows = steps
    .map((s) => {
      const entry = journal[s.method];
      let stamp: string;
      if (entry?.chainTime) {
        stamp = `${formatChainTime(entry.chainTime)} (chain block time)<br><a href="${EXPLORER}/tx/${entry.hash}">${entry.hash.slice(0, 18)}...</a>`;
      } else if (entry) {
        stamp = `${formatTime(entry.at)} (recorded on this device)<br><a href="${EXPLORER}/tx/${entry.hash}">${entry.hash.slice(0, 18)}...</a>`;
      } else {
        stamp = "Not recorded on this device";
      }
      return `<tr><td>${s.label}</td><td>${stamp}</td></tr>`;
    })
    .join("");

  const history = task.evidence_history
    .map(
      (e, i) =>
        `<tr><td>Round ${i + 1}</td><td>${e.verdict?.approved ? "Approved" : "Rejected"} (${e.verdict?.confidence ?? "?"} / 100)</td><td class="mono">${esc(e.proof_hash.slice(0, 16))}...</td></tr>`,
    )
    .join("");

  const doc = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Receipt ${esc(receiptNo)}: SiteVerdict</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#22201B;max-width:640px;margin:24px auto;padding:0 16px;}
.brand{font-size:28px;font-weight:800;letter-spacing:2px;}
.rule{height:10px;background:repeating-linear-gradient(-45deg,#D99400 0 14px,#22201B 14px 28px);margin:8px 0 16px;}
h1{font-size:20px;letter-spacing:1px;}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px;}
td,th{border:1px solid #999;text-align:left;padding:6px 8px;vertical-align:top;}
.mono{font-family:monospace;font-size:12px;word-break:break-all;}
.small{font-size:12px;color:#555;}
a{color:#1E7A3C;}
@media print{.noprint{display:none;}}
</style></head><body>
<div class="brand">SITEVERDICT</div>
<div class="rule"></div>
<h1>WORK COMPLETION RECEIPT ${esc(receiptNo)}</h1>
<p>Issued ${esc(issuedAt)} · Network ${esc(NETWORK_NAME)} · Contract<br>
<span class="mono">${esc(CONTRACT_ADDRESS)}</span><br>
<a href="${EXPLORER}/address/${esc(CONTRACT_ADDRESS)}">Verify contract in explorer</a></p>
<table>
<tr><th>Job code</th><td class="mono">${esc(task.id)}</td></tr>
<tr><th>Description</th><td>${esc(task.description)}</td></tr>
<tr><th>Acceptance criteria</th><td>${esc(task.requirements)}</td></tr>
<tr><th>Wage (atto GEN)</th><td class="mono">${esc(task.reward_atto)}</td></tr>
<tr><th>Client</th><td class="mono">${esc(task.creator)}</td></tr>
<tr><th>Worker</th><td class="mono">${esc(task.worker)}</td></tr>
</table>
<h1>AI CONSENSUS VERDICT</h1>
<p><strong>${verdict?.approved ? "APPROVED" : "REJECTED"}</strong> · confidence ${verdict?.confidence ?? "?"}/100</p>
<p>${esc(verdict?.reasoning ?? "")}</p>
<table><tr><th>Round</th><th>Outcome</th><th>Evidence hash</th></tr>${history}</table>
<h1>TIMELINE (DEVICE RECORD)</h1>
<table><tr><th>Step</th><th>Time · transaction</th></tr>${rows}</table>
<p class="small">Chain block times come from the chain itself and cannot be edited from this app. Device-recorded times are a fallback when the block lookup fails. Verdicts, hashes, and history are read from the contract. Check every hash in the explorer before relying on this receipt.</p>
<p class="noprint"><button onclick="window.print()" style="padding:12px 24px;font-size:16px;">Print / Save PDF</button></p>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(doc);
  w.document.close();
  w.focus();
}
