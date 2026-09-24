"use client";

// Device-side journal: every successful write records its transaction hash
// and finalization time, keyed by contract + job + method. The chain holds
// the verdict; this journal holds the paper trail (hashes, times) that a
// printed receipt needs. Entries only ever come from transactions this
// browser watched finalize.

import { CONTRACT_ADDRESS } from "./config";

export interface JournalEntry {
  hash: string;
  at: string;
  /** Unix seconds from the chain block. Absent when the lookup failed. */
  chainTime?: number;
}

const KEY = "siteverdict_tx_journal_v1";

type Journal = Record<string, Record<string, Record<string, JournalEntry>>>;

function load(): Journal {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Journal;
  } catch {
    return {};
  }
}

export function recordTx(jobId: string, method: string, hash: string, chainTime?: number): void {
  try {
    const journal = load();
    const byContract = (journal[CONTRACT_ADDRESS] ??= {});
    const byJob = (byContract[jobId] ??= {});
    byJob[method] = { hash, at: new Date().toISOString(), ...(chainTime ? { chainTime } : {}) };
    localStorage.setItem(KEY, JSON.stringify(journal));
  } catch {
    /* journal is best-effort; the chain stays source of truth */
  }
}

export function getJobJournal(jobId: string): Record<string, JournalEntry> {
  try {
    return load()[CONTRACT_ADDRESS]?.[jobId] ?? {};
  } catch {
    return {};
  }
}
