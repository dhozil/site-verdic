"use client";

import { useCallback, useEffect, useState } from "react";
import SiteNav from "@/components/SiteNav";
import WalletPicker from "@/components/WalletPicker";
import { WalletContext } from "@/components/wallet-context";
import {
  ensureStudionet,
  requestAccounts,
  type TxUpdate,
} from "@/lib/genlayer";
import {
  clearStoredSelection,
  discoverWallets,
  friendlyError,
  getStoredSelection,
  matchStored,
  setStoredSelection,
  type DiscoveredWallet,
  type WalletProvider,
} from "@/lib/wallets";
import { CONTRACT_ADDRESS, NETWORK_NAME } from "@/lib/config";

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState<TxUpdate | null>(null);

  const refreshWallets = useCallback(async () => {
    setDiscovering(true);
    try {
      setWallets(await discoverWallets());
    } finally {
      setDiscovering(false);
    }
  }, []);

  async function activate(wallet: DiscoveredWallet) {
    setConnecting(true);
    try {
      await ensureStudionet(wallet.provider);
      const acc = await requestAccounts(wallet.provider);
      setProvider(wallet.provider);
      setAccount(acc);
      setWalletLabel(wallet.label);
      setStoredSelection({ id: wallet.id, kind: wallet.kind, label: wallet.label });
      setPickerOpen(false);
      setNotice(null);
    } catch (err) {
      setNotice({ message: friendlyError(err, "Could not connect the wallet."), isError: true });
    } finally {
      setConnecting(false);
    }
  }

  function handleDisconnect() {
    setProvider(null);
    setAccount(null);
    setWalletLabel(null);
    clearStoredSelection();
    setNotice(null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getStoredSelection();
      if (!stored) return;
      const options = await discoverWallets();
      if (cancelled) return;
      const match = matchStored(options, stored);
      if (!match) return;
      try {
        const acc = await requestAccounts(match.provider);
        if (cancelled) return;
        await ensureStudionet(match.provider);
        if (cancelled) return;
        setProvider(match.provider);
        setAccount(acc);
        setWalletLabel(match.label);
      } catch {
        /* user has not approved yet, stay manual */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!provider?.on) return;
    const onAccounts = (data: unknown) => {
      const list = Array.isArray(data) ? data.filter((a): a is string => typeof a === "string") : [];
      if (list.length === 0) handleDisconnect();
      else setAccount(list[0]);
    };
    const onChain = () => {
      void ensureStudionet(provider).catch((err: unknown) =>
        setNotice({ message: friendlyError(err, "Wallet network changed."), isError: true }),
      );
    };
    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  return (
    <WalletContext.Provider
      value={{
        account,
        provider,
        walletLabel,
        connecting,
        openPicker: () => {
          setPickerOpen(true);
          void refreshWallets();
        },
      }}
    >
      <SiteNav
        account={account}
        walletLabel={walletLabel}
        onConnect={() => {
          setPickerOpen(true);
          void refreshWallets();
        }}
        onDisconnect={handleDisconnect}
        connecting={connecting}
      />
      {notice && (
        <div className="mx-auto w-full max-w-5xl px-4">
          <p
            role="status"
            className={`mt-5 rounded-md border border-line bg-card px-4 py-3 ${
              notice.isError ? "border-l-[6px] border-l-bad" : "border-l-[6px] border-l-brand"
            }`}
          >
            {notice.message}
          </p>
        </div>
      )}
      {children}
      <footer className="mx-auto w-full max-w-5xl px-4">
        <div className="hazard h-2 rounded-t-md" aria-hidden="true" />
        <p className="border border-line border-t-0 px-4 py-4 text-sm">
          Network: {NETWORK_NAME}. Contract: <code className="break-all">{CONTRACT_ADDRESS}</code>
        </p>
      </footer>
      <WalletPicker
        open={pickerOpen}
        wallets={wallets}
        discovering={discovering}
        onPick={(w) => void activate(w)}
        onRefresh={() => void refreshWallets()}
        onClose={() => setPickerOpen(false)}
      />
    </WalletContext.Provider>
  );
}
