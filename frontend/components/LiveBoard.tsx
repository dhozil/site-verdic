"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readTask, readTaskIds } from "@/lib/genlayer";

// Live numbers for the landing page. Read from the contract, so every
// figure on this page has a source.
export default function LiveBoard() {
  const [line, setLine] = useState("Reading live numbers from the contract...");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = await readTaskIds();
        let decided = 0;
        for (const id of ids) {
          try {
            const t = await readTask(id);
            if (t.status === "APPROVED" || t.status === "REJECTED" || t.status === "PAID") decided += 1;
          } catch {
            /* skip */
          }
        }
        if (!cancelled) setLine(`${ids.length} jobs posted, ${decided} settled by validator verdict.`);
      } catch {
        if (!cancelled) setLine("Live numbers unavailable right now. Open the console to retry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p role="status" className="mt-4 inline-block rounded bg-paper/10 px-4 py-2 font-semibold">
      {line}{" "}
      <Link href="/console" className="underline underline-offset-4">
        Verify it yourself
      </Link>
    </p>
  );
}
