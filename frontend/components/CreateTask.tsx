"use client";

import { useState } from "react";
import { sendWrite, sha256Hex, type TxUpdate } from "@/lib/genlayer";
import { compressPhoto } from "@/lib/images";
import { friendlyTransport } from "@/lib/errors";
import type { WalletProvider } from "@/lib/wallets";

interface Props {
  account: string | null;
  provider: WalletProvider | null;
  onTx: (update: TxUpdate | null) => void;
  onCreated: () => void | Promise<void>;
  onJobExists: (id: string) => void;
}

export default function CreateTask({ account, provider, onTx, onCreated, onJobExists }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const active = provider;
    const user = account;
    if (!user || !active) {
      onTx({ message: "Connect a wallet before posting a job.", isError: true });
      return;
    }
    const data = new FormData(form);
    const missing: string[] = [];
    if (!String(data.get("task_id")).trim()) missing.push("job code");
    if (!String(data.get("description")).trim()) missing.push("work description");
    if (!String(data.get("requirements")).trim()) missing.push("acceptance criteria");
    if (!String(data.get("location")).trim()) missing.push("site location");
    if (data.get("reward") === "" || Number.isNaN(Number(data.get("reward")))) missing.push("wage");
    const refUrl = String(data.get("reference_url") ?? "").trim();
    if (refUrl && !/^https?:\/\//i.test(refUrl)) missing.push("reference photo URL (http(s))");
    if (missing.length > 0) {
      onTx({ message: `Fill these first: ${missing.join(", ")}.`, isError: true });
      return;
    }
    const rewardAtto = BigInt(Math.round(Number(data.get("reward")) * 1e18));
    const baselineFile = data.get("baseline_file");
    let baselineHash = "";
    if (baselineFile instanceof File && baselineFile.size > 0) {
      try {
        const compressed = await compressPhoto(baselineFile);
        baselineHash = await sha256Hex(compressed.buffer);
      } catch (err) {
        onTx({
          message: err instanceof Error ? err.message : "Could not process the baseline photo.",
          isError: true,
        });
        return;
      }
    }
    setBusy(true);
    try {
      await sendWrite(
        active,
        user,
        "create_task",
        [
          String(data.get("task_id")).trim(),
          String(data.get("description")).trim(),
          String(data.get("requirements")).trim(),
          rewardAtto,
          baselineHash,
          String(data.get("location")).trim(),
          String(data.get("reference_url") ?? "").trim(),
        ],
        onTx,
      );
      form.reset();
      await onCreated();
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith("execution failed")) {
        onTx({ message: friendlyTransport(err, "Posting failed."), isError: true });
      } else if (err instanceof Error && err.message.includes("already exists")) {
        // The code is taken: refresh and open the existing job instead.
        await onCreated();
        onJobExists(String(data.get("task_id")).trim());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="h-create" className="mt-10 rounded-md border border-line border-t-4 border-t-brand bg-card p-5">
      <h2 id="h-create" className="font-sign text-xl font-semibold uppercase tracking-wide">
        Post a new job
      </h2>
      <p className="mt-1 text-sm text-muted">
        Terms are written once and cannot be edited. A changed job needs a new code.
      </p>
      <div>
        <form onSubmit={handleSubmit} noValidate className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-semibold">
            Job code
            <input
              name="task_id"
              required
              maxLength={64}
              autoComplete="off"
              placeholder="e.g. repaint-living-room-01"
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 font-semibold">
            Work description
            <input
              name="description"
              required
              maxLength={280}
              autoComplete="off"
              placeholder="e.g. Repaint the 3x4 m living room wall"
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 font-semibold">
            Acceptance criteria
            <input
              name="requirements"
              required
              maxLength={280}
              autoComplete="off"
              placeholder="e.g. Two coats of light blue, clean white trim"
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 font-semibold">
            Site location
            <input
              name="location"
              required
              maxLength={200}
              autoComplete="off"
              placeholder="e.g. Jl. Merdeka No. 45, Bandung"
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 font-semibold">
            Reference photo URL (optional)
            <input
              name="reference_url"
              type="url"
              maxLength={500}
              autoComplete="off"
              placeholder="https://... (what the site looks like)"
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
            <span className="text-sm font-normal text-muted">
              Shown to workers. Display only, not verified evidence.
            </span>
          </label>
          <label className="grid gap-1 font-semibold">
            Baseline before photo (optional)
            <input
              name="baseline_file"
              type="file"
              accept="image/png,image/jpeg"
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
            <span className="text-sm font-normal text-muted">
              Your own photo of the current state. The worker&apos;s before photo
              must hash to the same value.
            </span>
          </label>
          <label className="grid gap-1 font-semibold">
            Wage (GEN)
            <input
              name="reward"
              type="number"
              min="0"
              step="any"
              defaultValue="5"
              required
              className="min-h-[44px] rounded-md border border-line bg-card px-3 font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] rounded-md border border-ink bg-ink px-4 font-semibold text-paper disabled:cursor-wait disabled:opacity-55 sm:col-span-2"
          >
            {busy ? "Posting..." : "Post Work Order"}
          </button>
        </form>
      </div>
    </section>
  );
}
