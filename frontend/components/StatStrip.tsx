"use client";

export interface BoardStats {
  total: number;
  open: number;
  submitted: number;
  decided: number;
}

export default function StatStrip({ stats, loading }: { stats: BoardStats | null; loading: boolean }) {
  const cells: { label: string; value: number }[] = stats
    ? [
        { label: "Total jobs", value: stats.total },
        { label: "Open", value: stats.open },
        { label: "Awaiting AI verdict", value: stats.submitted },
        { label: "Decided", value: stats.decided },
      ]
    : [];

  return (
    <section aria-labelledby="h-board" className="mt-8">
      <h2 id="h-board" className="font-sign text-xl font-semibold uppercase tracking-wide">
        Live board
      </h2>
      <p className="mt-1 text-sm text-muted">Counted from the contract, not marketing numbers.</p>
      {loading && (
        <p role="status" className="mt-2">
          Counting from the contract...
        </p>
      )}
      {!loading && !stats && <p className="mt-2">No counts yet. Press Reload List.</p>}
      {!loading && stats && (
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cells.map((c) => (
            <div
              key={c.label}
              className="rounded-md border border-line border-t-4 border-t-brand bg-card px-4 py-3"
            >
              <dt className="text-sm text-muted">{c.label}</dt>
              <dd className="font-sign text-4xl font-semibold">{c.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
