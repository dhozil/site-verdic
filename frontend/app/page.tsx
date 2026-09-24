import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import LiveBoard from "@/components/LiveBoard";
import CompareSlider from "@/components/CompareSlider";

export const metadata = {
  title: "SiteVerdict: renovation work settled by photo evidence",
  description:
    "Post renovation jobs, prove completion with before-and-after photos, and let independent AI validators settle payment.",
};

const STEPS = [
  {
    n: "01",
    title: "Lock the job in writing",
    body: "The client posts the work description, the acceptance criteria, and the wage. The terms sit on-chain where neither side can quietly rewrite them.",
  },
  {
    n: "02",
    title: "Prove it with two photos",
    body: "The worker submits a before and an after photo of the same spot. Both files are hashed, so swapped or edited photos do not match the record.",
  },
  {
    n: "03",
    title: "Independent validators decide",
    body: "GenLayer validators re-run the same photo inspection independently: same location, visible progress, criteria met. The majority verdict is final.",
  },
  {
    n: "04",
    title: "The wage moves on verdict",
    body: "Approved: the worker claims the wage. Rejected: one appeal with new photos, or the client withdraws the job. No adjuster, no waiting room.",
  },
];

export default function Home() {
  return (
    <SiteShell>
      <main className="flex-1">
        <section className="bg-ink text-paper">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h1 className="font-sign max-w-3xl text-5xl font-semibold uppercase leading-[1.05] tracking-wide sm:text-6xl">
              Renovation work, settled by photo evidence
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-paper/85">
              SiteVerdict records the job on-chain, checks before-and-after photos with
              independent AI validators, and releases the wage only when the work is
              proven. Promises are not accepted as proof.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/console"
                className="min-h-[44px] rounded-md bg-brand px-6 py-3 font-bold text-ink transition-colors hover:bg-paper"
              >
                Open the Console
              </Link>
              <Link
                href="/how-it-works"
                className="min-h-[44px] rounded-md border border-paper/60 px-6 py-3 font-semibold text-paper transition-colors hover:bg-paper/10"
              >
                See how verification works
              </Link>
            </div>
            <LiveBoard />
          </div>
          <div className="hazard h-2" aria-hidden="true" />
        </section>

        <section aria-labelledby="h-sample" className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid items-start gap-8 md:grid-cols-5">
            <div className="md:col-span-2">
              <h2 id="h-sample" className="font-sign text-3xl font-semibold uppercase tracking-wide">
                The whole case is two photos
              </h2>
              <p className="mt-3">
                Drag the handle. The left side shows the wall before: cracked, stained,
                unpainted. The right side shows the same wall after: clean light blue
                paint, white trim. These are the actual sample photos used in our
                contract tests, and validators approved this pair at 95 confidence.
              </p>
              <p className="mt-3">
                A pair from two different rooms, or with no visible change, gets
                rejected. That strictness is the product.
              </p>
            </div>
            <div className="md:col-span-3">
              <CompareSlider beforeUrl="/samples/before.png" afterUrl="/samples/after.png" />
            </div>
          </div>
        </section>

        <section aria-labelledby="h-steps" className="border-y border-line bg-card">
          <div className="mx-auto max-w-5xl px-4 py-12">
            <h2 id="h-steps" className="font-sign text-3xl font-semibold uppercase tracking-wide">
              From posting to payout in four moves
            </h2>
            <ol className="mt-6 grid gap-0 border-t border-line">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="grid gap-1 border-b border-line py-5 sm:grid-cols-[4rem_1fr] sm:gap-6"
                >
                  <span className="font-sign text-3xl font-semibold text-brand-deep" aria-hidden="true">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-sign text-xl font-semibold uppercase tracking-wide">
                      {s.title}
                    </h3>
                    <p className="mt-1 max-w-2xl">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/how-it-works"
              className="mt-6 inline-block min-h-[44px] rounded-md border border-ink px-6 py-3 font-semibold transition-colors hover:bg-ink hover:text-paper"
            >
              Read the full procedure
            </Link>
          </div>
        </section>

        <section aria-labelledby="h-why" className="mx-auto max-w-5xl px-4 py-12">
          <h2 id="h-why" className="font-sign text-3xl font-semibold uppercase tracking-wide">
            Why the verdict holds up
          </h2>
          <ul className="mt-4 grid max-w-3xl gap-3">
            <li className="rounded-md border border-line border-l-[6px] border-l-brand bg-card px-4 py-3">
              <strong>Same-spot rule.</strong> Both photos must show the same location with
              visible progress, or the verdict is reject.
            </li>
            <li className="rounded-md border border-line border-l-[6px] border-l-brand bg-card px-4 py-3">
              <strong>Hash-bound evidence.</strong> Every photo is SHA-256 hashed at
              submit time. What the validators see is what was submitted.
            </li>
            <li className="rounded-md border border-line border-l-[6px] border-l-brand bg-card px-4 py-3">
              <strong>Validators re-run, not rubber-stamp.</strong> Each validator runs
              the inspection itself and compares only the decision, never the wording.
            </li>
            <li className="rounded-md border border-line border-l-[6px] border-l-brand bg-card px-4 py-3">
              <strong>One appeal, then it is over.</strong> A rejected worker gets a
              single second chance with new photos. After that the decision stands.
            </li>
          </ul>
          <div className="mt-8 rounded-md bg-ink px-6 py-8 text-paper">
            <h3 className="font-sign text-2xl font-semibold uppercase tracking-wide">
              Put your first job on the board
            </h3>
            <p className="mt-2 max-w-xl text-paper/85">
              Connect a wallet, post the work, and watch independent validators judge
              real photos. The trial network charges no gas.
            </p>
            <Link
              href="/console"
              className="mt-4 inline-block min-h-[44px] rounded-md bg-brand px-6 py-3 font-bold text-ink transition-colors hover:bg-paper"
            >
              Post a Job
            </Link>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

