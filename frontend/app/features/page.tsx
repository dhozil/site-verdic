import Link from "next/link";
import SiteShell from "@/components/SiteShell";

export const metadata = {
  title: "Features: SiteVerdict",
  description: "What the SiteVerdict renovation contract actually does, and nothing it does not.",
};

export default function FeaturesPage() {
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12">
        <h1 className="font-sign mt-10 text-4xl font-semibold uppercase tracking-wide sm:text-5xl">
          What the contract does
        </h1>
        <p className="mt-3 max-w-2xl text-lg">
          Six capabilities, each enforced by the WorkVerifier contract on GenLayer.
          Nothing on this page is a roadmap item.
        </p>

        <div className="mt-8 grid gap-6">
          <section aria-labelledby="f-pair" className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line border-t-4 border-t-brand bg-card p-5">
              <h2 id="f-pair" className="font-sign text-2xl font-semibold uppercase tracking-wide">
                Before-after inspection
              </h2>
              <p className="mt-2">
                The verdict reads two photos as one case: same location, visible
                progress, criteria from the work order met. Blur, wrong rooms, and
                untouched walls fail loudly with a written reason.
              </p>
            </div>
            <div className="rounded-md border border-line bg-card p-5">
              <h2 className="font-sign text-2xl font-semibold uppercase tracking-wide">
                Hash-bound evidence
              </h2>
              <p className="mt-2">
                Both photos are SHA-256 hashed in the browser before submit. The
                hashes live on-chain next to the verdict, so anyone can later check
                that the judged photos are the submitted ones.
              </p>
            </div>
          </section>

          <section aria-labelledby="f-consensus" className="rounded-md bg-ink px-6 py-8 text-paper">
            <h2 id="f-consensus" className="font-sign text-2xl font-semibold uppercase tracking-wide">
              Consensus, not a single opinion
            </h2>
            <p className="mt-2 max-w-2xl text-paper/85">
              A leader validator inspects the pair first. Every other validator
              re-runs the same inspection and compares the decision: approve or
              reject, confidence within 15 points. Reasoning text is never compared,
              because wording always differs. Only agreement settles.
            </p>
          </section>

          <section aria-labelledby="f-money" className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-line bg-card p-5">
              <h2 id="f-money" className="font-sign text-xl font-semibold uppercase tracking-wide">
                Wage on verdict
              </h2>
              <p className="mt-2 text-sm">
                Approval unlocks the claim for the worker address only. Nobody else
                can collect it.
              </p>
            </div>
            <div className="rounded-md border border-line bg-card p-5">
              <h2 className="font-sign text-xl font-semibold uppercase tracking-wide">
                One appeal
              </h2>
              <p className="mt-2 text-sm">
                A rejection can be challenged exactly once, with a fresh photo pair.
                The counter is on-chain, so a second appeal is impossible.
              </p>
            </div>
            <div className="rounded-md border border-line bg-card p-5">
              <h2 className="font-sign text-xl font-semibold uppercase tracking-wide">
                Clean exit
              </h2>
              <p className="mt-2 text-sm">
                While a job is open or rejected, the client can withdraw it. Money
                never gets stuck waiting for a verdict that will not come.
              </p>
            </div>
          </section>

          <section aria-labelledby="f-read" className="rounded-md border border-line border-l-[6px] border-l-brand bg-card p-5">
            <h2 id="f-read" className="font-sign text-2xl font-semibold uppercase tracking-wide">
              Readable by anyone
            </h2>
            <p className="mt-2 max-w-2xl">
              Every job, hash, and verdict is a public view call. No account needed
              to audit the board. Open the console and check any job code.
            </p>
            <Link
              href="/console"
              className="mt-4 inline-block min-h-[44px] rounded-md border border-ink px-6 py-3 font-semibold transition-colors hover:bg-ink hover:text-paper"
            >
              Audit the Board
            </Link>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}

