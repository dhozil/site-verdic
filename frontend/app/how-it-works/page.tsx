import Link from "next/link";
import SiteShell from "@/components/SiteShell";

export const metadata = {
  title: "How it works: SiteVerdict",
  description: "The four-move procedure from posting a renovation job to payout, plus answers.",
};

const STEPS = [
  {
    n: "01",
    title: "Post the job",
    body: "In the console, fill the work order form: a job code, what needs doing, the exact acceptance criteria, the site location, an optional reference photo link and baseline photo, plus the wage in GEN. The client address is recorded as the job owner. Connect MetaMask or Rabby first; the trial network charges no gas.",
  },
  {
    n: "02",
    title: "Join, then get approved",
    body: "A worker presses Join Job on an open listing. Nothing is assigned yet: the client reviews the applicant and presses Approve Worker, or rejects the application. The client can never join its own job; the contract reverts self-submission.",
  },
  {
    n: "03",
    title: "Submit, then confirm the evidence",
    body: "The approved worker photographs the same spot before and after the work and submits both files. The browser hashes each file with SHA-256 and stores the hashes on-chain. If the client committed a baseline photo at posting time, the before photo must hash to it. The client then confirms the submission, which unlocks judgment. Either side can back out before confirmation: the worker retracts, the client rejects or cancels.",
  },
  {
    n: "04",
    title: "Validators inspect and agree",
    body: "Anyone presses Request AI Verification. The contract first checks both photos against the committed hashes, so substituted images fail before any AI runs. A leader validator inspects the pair against the criteria and returns approve or reject with a confidence score. Each remaining validator re-runs the inspection and accepts only if its own decision matches. Expect about a minute.",
  },
  {
    n: "05",
    title: "Money moves on the verdict",
    body: "Approved jobs let the worker address claim the wage. Rejected jobs allow exactly one appeal with a new photo pair. Clients can withdraw jobs that are still open or rejected. Every step is a signed transaction with a hash you can copy.",
  },
];

const FAQ = [
  {
    q: "What photos pass?",
    a: "Same location in both shots, clearly visible change, and the finished state matching the acceptance criteria. Good light helps. Screenshots, stock photos, and two different rooms fail.",
  },
  {
    q: "Who are the validators?",
    a: "Independent GenLayer validator nodes running vision models. No single model decides: the verdict needs agreement across re-runs, and confidence must land within 15 points.",
  },
  {
    q: "What does it cost to try?",
    a: "The console runs on studionet, the trial network, where transactions are gasless. You only need a browser wallet with no funds in it.",
  },
  {
    q: "What if my work is rejected unfairly?",
    a: "File one appeal with a better photo pair, ideally closer shots that show the finished criteria. If the appeal also rejects, the decision stands and the client may withdraw the job.",
  },
  {
    q: "Can I take my own job?",
    a: "No. The contract rejects proof submitted by the client address, so poster and worker are always two different wallets. To demo both sides yourself, connect a second wallet or browser profile.",
  },
  {
    q: "Can the client change the terms mid-job?",
    a: "No. Description, criteria, and wage are written at posting time and the contract has no edit function. A changed job needs a new job code.",
  },
];

export default function HowItWorksPage() {
  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12">
        <h1 className="font-sign mt-10 text-4xl font-semibold uppercase tracking-wide sm:text-5xl">
          How verification works
        </h1>
        <p className="mt-3 max-w-2xl text-lg">
          Six moves, each a signed on-chain transaction. No accounts, no office,
          no waiting room.
        </p>

        <ol className="mt-8 grid gap-0 border-t border-line">
          {STEPS.map((s) => (
            <li key={s.n} className="grid gap-1 border-b border-line py-6 sm:grid-cols-[4rem_1fr] sm:gap-6">
              <span className="font-sign text-3xl font-semibold text-brand-deep" aria-hidden="true">
                {s.n}
              </span>
              <div>
                <h2 className="font-sign text-2xl font-semibold uppercase tracking-wide">{s.title}</h2>
                <p className="mt-2 max-w-2xl">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section aria-labelledby="h-faq" className="mt-12">
          <h2 id="h-faq" className="font-sign text-3xl font-semibold uppercase tracking-wide">
            Asked on real jobs
          </h2>
          <div className="mt-4 grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-md border border-line bg-card px-4 py-3">
                <summary className="min-h-[44px] cursor-pointer font-bold">{f.q}</summary>
                <p className="mt-1 max-w-2xl">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <Link
          href="/console"
          className="mt-8 inline-block min-h-[44px] rounded-md bg-brand px-6 py-3 font-bold text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Try It in the Console
        </Link>
      </main>
    </SiteShell>
  );
}

