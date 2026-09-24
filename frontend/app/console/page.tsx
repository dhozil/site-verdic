import { Suspense } from "react";
import SiteShell from "@/components/SiteShell";
import ConsoleBoard from "@/components/ConsoleBoard";

export const metadata = {
  title: "Console: SiteVerdict",
  description: "Post renovation jobs, submit before-after photo proof, and settle by AI verdict.",
};

export default function ConsolePage() {
  return (
    <SiteShell>
      <Suspense fallback={<main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12"><p role="status" className="mt-10">Loading the console...</p></main>}>
        <ConsoleBoard />
      </Suspense>
    </SiteShell>
  );
}

