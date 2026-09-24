"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { shortAddr } from "@/lib/genlayer";

interface Props {
  account: string | null;
  walletLabel: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  connecting: boolean;
}

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/console", label: "Console" },
];

export default function SiteNav({ account, walletLabel, onConnect, onDisconnect, connecting }: Props) {
  const pathname = usePathname();

  return (
    <header className="bg-ink text-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-5">
        <Link href="/" className="font-sign text-2xl font-semibold tracking-wide uppercase">
          SiteVerdict
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={pathname === l.href ? "page" : undefined}
                  className={`block min-h-[44px] rounded-md px-3 py-2.5 font-semibold transition-colors hover:bg-paper/10 ${
                    pathname === l.href ? "underline decoration-brand decoration-2 underline-offset-8" : ""
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block h-3 w-3 rounded-full ${account ? "bg-brand" : "bg-paper/40"}`}
          />
          <span className="text-sm">
            {account ? `${walletLabel ?? "Wallet"}: ${shortAddr(account)}` : "Wallet not connected"}
          </span>
          {account ? (
            <button
              type="button"
              onClick={onDisconnect}
              className="min-h-[44px] rounded-md border border-paper/60 bg-transparent px-4 text-paper transition-colors hover:bg-paper/10"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={connecting}
              className="min-h-[44px] rounded-md bg-brand px-5 font-bold text-ink transition-colors hover:bg-paper disabled:opacity-55"
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
      <div className="hazard h-2" aria-hidden="true" />
    </header>
  );
}

