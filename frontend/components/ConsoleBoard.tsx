"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TxBanner from "@/components/TxBanner";
import CreateTask from "@/components/CreateTask";
import TaskList from "@/components/TaskList";
import TaskDetail from "@/components/TaskDetail";
import StatStrip, { type BoardStats } from "@/components/StatStrip";
import { useWallet } from "@/components/wallet-context";
import {
  readTask,
  readTaskIds,
  type TaskView,
  type TxUpdate,
} from "@/lib/genlayer";
import { friendlyTransport } from "@/lib/errors";

function summarize(tasks: TaskView[]): BoardStats {
  return {
    total: tasks.length,
    open: tasks.filter((t) => t.status === "OPEN").length,
    submitted: tasks.filter((t) => t.status === "SUBMITTED").length,
    decided: tasks.filter((t) =>
      t.status === "APPROVED" || t.status === "REJECTED" || t.status === "PAID",
    ).length,
  };
}

export default function ConsoleBoard() {
  const { account, provider } = useWallet();
  const searchParams = useSearchParams();
  const [tx, setTx] = useState<TxUpdate | null>(null);
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [listState, setListState] = useState("The list has not loaded. Press Reload List.");
  const [listLoading, setListLoading] = useState(false);
  const [task, setTask] = useState<TaskView | null>(null);
  const [filter, setFilter] = useState<"all" | "client" | "worker">("all");
  const detailAnchor = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListState("Loading the list...");
    try {
      const found = await readTaskIds();
      const results = await Promise.allSettled(found.map((id) => readTask(id)));
      const views = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      setTasks(views);
      setStats(summarize(views));
      setListState(
        views.length === 0
          ? "No jobs yet. Post the first one with the form above."
          : `${views.length} jobs on record.`,
      );
    } catch (err) {
      setTasks([]);
      setStats(null);
      setListState(friendlyTransport(err, "Could not load the list."));
    } finally {
      setListLoading(false);
    }
  }, []);

  const openTask = useCallback(async (id: string) => {
    setTx(null);
    try {
      setTask(await readTask(id));
      requestAnimationFrame(() => detailAnchor.current?.scrollIntoView({ block: "start" }));
    } catch (err) {
      setTx({ message: friendlyTransport(err, `Job not found: ${id}`), isError: true });
    }
  }, []);

  const refreshAll = useCallback(
    async (id?: string) => {
      await loadList();
      if (id) {
        try {
          setTask(await readTask(id));
        } catch {
          setTask(null);
        }
      }
    },
    [loadList],
  );

  const counts = {
    all: tasks.length,
    client: tasks.filter((t) => account && t.creator.toLowerCase() === account.toLowerCase()).length,
    worker: tasks.filter(
      (t) => account && t.worker !== "" && t.worker.toLowerCase() === account.toLowerCase(),
    ).length,
  };

  const visibleTasks = tasks.filter((t) => {
    if (filter === "all" || !account) return true;
    if (filter === "client") return t.creator.toLowerCase() === account.toLowerCase();
    return t.worker !== "" && t.worker.toLowerCase() === account.toLowerCase();
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openTaskAndSelect = useCallback(
    async (id: string) => {
      setSelectedId(id);
      await openTask(id);
    },
    [openTask],
  );

  // The board always reflects the chain: load on mount (reads need no
  // wallet) and reload whenever the connected account changes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await loadList();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await loadList();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // Deep link: /console?job=CODE opens the job directly (shareable via chat).
  useEffect(() => {
    const id = searchParams.get("job");
    if (!id) return;
    let cancelled = false;
    (async () => {
      await loadList();
      if (cancelled) return;
      setSelectedId(id);
      await openTask(id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12">
      <TxBanner update={tx} />
      <StatStrip stats={stats} loading={listLoading} />
      <CreateTask account={account} provider={provider} onTx={setTx} onCreated={loadList} onJobExists={openTaskAndSelect} />
      <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filter jobs">
        {(
          [
            ["all", `All jobs (${counts.all})`],
            ["client", `Jobs I posted (${counts.client})`],
            ["worker", `Jobs I work (${counts.worker})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`min-h-[44px] rounded-md border px-4 font-semibold ${
              filter === value
                ? "border-ink bg-ink text-paper"
                : "border-ink bg-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid items-start gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <TaskList
            tasks={visibleTasks}
            selectedId={selectedId}
            state={listState}
            loading={listLoading}
            onRefresh={loadList}
            onLookup={openTaskAndSelect}
            onOpen={openTaskAndSelect}
          />
        </div>
        <div ref={detailAnchor} className="scroll-mt-4 lg:col-span-7">
          {task ? (
            <TaskDetail task={task} account={account} provider={provider} onTx={setTx} onChanged={refreshAll} />
          ) : (
            <div className="rounded-md border border-dashed border-line bg-card px-5 py-10 text-center">
              <p className="font-sign text-xl font-semibold uppercase tracking-wide">
                No job selected
              </p>
              <p className="mt-1 text-muted">
                Pick a job from the list to inspect evidence, confirm, or verify.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
