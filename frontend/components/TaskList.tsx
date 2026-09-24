"use client";

import { shortAddr, type TaskView } from "@/lib/genlayer";

interface Props {
  tasks: TaskView[];
  selectedId: string | null;
  state: string;
  onRefresh: () => void;
  onLookup: (id: string) => void;
  onOpen: (id: string) => void;
  loading: boolean;
}

function chip(status: string): string {
  if (status === "APPROVED" || status === "PAID") return "bg-ok text-paper";
  if (status === "REJECTED" || status === "REFUNDED" || status === "CANCELLED")
    return "bg-bad text-paper";
  if (status === "SUBMITTED" || status === "CONFIRMED") return "bg-brand text-ink";
  return "bg-ink text-paper";
}

function rewardGen(atto: string): string {
  try {
    return (Number(BigInt(atto)) / 1e18).toString();
  } catch {
    return atto;
  }
}

export default function TaskList({ tasks, selectedId, state, onRefresh, onLookup, onOpen, loading }: Props) {
  function handleLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = String(new FormData(e.currentTarget).get("lookup_id")).trim();
    if (id) onLookup(id);
  }

  return (
    <section aria-labelledby="h-list" className="mt-4">
      <h2 id="h-list" className="font-sign text-xl font-semibold uppercase tracking-wide">
        Job list
      </h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <form onSubmit={handleLookup} className="flex flex-1 flex-wrap items-end gap-2">
          <label htmlFor="lookup-id" className="sr-only">
            Job code
          </label>
          <input
            id="lookup-id"
            name="lookup_id"
            maxLength={64}
            autoComplete="off"
            placeholder="Look up a job code"
            className="min-h-[44px] flex-1 rounded-md border border-line bg-card px-3"
          />
          <button
            type="submit"
            className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold transition-colors hover:bg-ink hover:text-paper"
          >
            Find Job
          </button>
        </form>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold transition-colors hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-55"
        >
          {loading ? "Loading..." : "Reload List"}
        </button>
      </div>
      <p role="status" className="mt-3">
        {state}
      </p>
      <ul className="mt-4 grid gap-3">
        {tasks.map((t) => (
          <li
            key={t.id}
            className={`flex flex-col gap-2 rounded-md border bg-card px-4 py-3 ${
              selectedId === t.id
                ? "border-ink border-l-[6px] border-l-brand outline outline-2 outline-ink"
                : "border-line border-l-[6px] border-l-brand"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="font-bold">{t.id}</code>
              <span className={`rounded px-2 py-0.5 text-sm font-bold ${chip(t.status)}`}>
                {t.status}
              </span>
            </div>
            <p className="mt-0 line-clamp-2">{t.description}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted">
                Wage {rewardGen(t.reward_atto)} GEN
                {t.worker ? `, worker ${shortAddr(t.worker)}` : ""}
              </span>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                aria-current={selectedId === t.id ? "true" : undefined}
                className="min-h-[44px] rounded-md border border-ink bg-transparent px-4 font-semibold transition-colors hover:bg-ink hover:text-paper"
              >
                {selectedId === t.id ? "Selected" : "Open Details"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
