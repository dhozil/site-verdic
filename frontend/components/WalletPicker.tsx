"use client";

import { useEffect, useRef } from "react";
import { KNOWN_WALLETS, type DiscoveredWallet } from "@/lib/wallets";

interface Props {
  open: boolean;
  wallets: DiscoveredWallet[];
  discovering: boolean;
  onPick: (wallet: DiscoveredWallet) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export default function WalletPicker({ open, wallets, discovering, onPick, onRefresh, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-md border border-line bg-paper p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="wallet-title" className="font-sign text-xl font-semibold uppercase tracking-wide">
            Choose a wallet
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close wallet picker"
            className="min-h-[44px] min-w-[44px] rounded-md border border-line bg-transparent px-3"
          >
            X
          </button>
        </div>

        {discovering && wallets.length === 0 && <p role="status">Looking for installed wallets...</p>}

        {!discovering && wallets.length === 0 && (
          <div className="mt-3">
            <p>No wallet detected in this browser. Install one of these:</p>
            <ul className="mt-2 grid gap-2">
              {KNOWN_WALLETS.map((w) => (
                <li key={w.id}>
                  <a
                    href={w.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block min-h-[44px] rounded-md border border-ink px-4 py-2.5 text-center font-semibold"
                  >
                    Install {w.label}
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 min-h-[44px] w-full rounded-md border border-ink bg-transparent px-4"
            >
              Try Again
            </button>
          </div>
        )}

        {wallets.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {wallets.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onPick(w)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-md border border-line bg-card px-4 py-2.5 text-left"
                >
                  {w.icon && (
                    // Icon comes from the wallet itself (real data), not generated.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.icon} alt="" width={28} height={28} className="h-7 w-7" />
                  )}
                  <span>
                    <span className="block font-bold">{w.label}</span>
                    <span className="block text-sm text-muted">Connect {w.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
