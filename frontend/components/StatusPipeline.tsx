"use client";

// Where a job sits in its lifecycle, drawn from its real status.
// Terminal states (paid, refunded, cancelled) close the pipe.
const PIPE = ["Posted", "Applied", "Assigned", "Evidence", "Confirmed", "Decided", "Settled"] as const;

function stageIndex(status: string): number {
  switch (status) {
    case "OPEN":
      return 0;
    case "APPLIED":
      return 1;
    case "ASSIGNED":
      return 2;
    case "SUBMITTED":
      return 3;
    case "CONFIRMED":
      return 4;
    case "APPROVED":
    case "REJECTED":
      return 5;
    case "PAID":
    case "REFUNDED":
    case "CANCELLED":
      return 6;
    default:
      return 0;
  }
}

export default function StatusPipeline({ status }: { status: string }) {
  const at = stageIndex(status);
  return (
    <ol aria-label={`Job stage: ${PIPE[at]} of 7`} className="mt-3 flex flex-wrap gap-1.5">
      {PIPE.map((step, i) => (
        <li
          key={step}
          aria-current={i === at ? "step" : undefined}
          className={`rounded px-2.5 py-1 text-sm font-bold ${
            i < at
              ? "bg-paper text-ink"
              : i === at
                ? "bg-brand text-ink outline outline-2 outline-paper"
                : "border border-paper/40 text-paper/70"
          }`}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}
