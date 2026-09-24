"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12">
      <h2 className="mt-10 font-sign text-xl font-semibold uppercase tracking-wide">
        This page failed to load
      </h2>
      <p className="mt-2">{error.message || "Something unexpected happened."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper"
      >
        Try Again
      </button>
    </main>
  );
}
