"use client";

// Deteksi dompet EIP-6963: tiap dompet (MetaMask, Rabby, lainnya) mengumumkan
// provider-nya sendiri, jadi pengguna memilih dompet secara eksplisit dan tidak
// ada perebutan window.ethereum. Pola diadaptasi dari Lex-Machina (dhozil).

export interface WalletProvider {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (data: unknown) => void) => void;
  removeListener?: (event: string, listener: (data: unknown) => void) => void;
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: WalletProvider[];
}

export type WalletKind = "metamask" | "rabby" | "other";

export interface DiscoveredWallet {
  id: string;
  kind: WalletKind;
  label: string;
  icon?: string;
  provider: WalletProvider;
}

interface AnnouncedDetail {
  info: { uuid?: string; name?: string; icon?: string; rdns?: string };
  provider: WalletProvider;
}

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export const KNOWN_WALLETS = [
  { id: "metamask", label: "MetaMask", installUrl: "https://metamask.io/download/" },
  { id: "rabby", label: "Rabby", installUrl: "https://rabby.io/" },
] as const;

const SELECTION_KEY = "pow_wallet_selection";

const announced: AnnouncedDetail[] = [];
let listenerInstalled = false;

function validProvider(p: unknown): p is WalletProvider {
  return (
    !!p &&
    typeof p === "object" &&
    typeof (p as WalletProvider).request === "function"
  );
}

function ensureListener() {
  if (typeof window === "undefined" || listenerInstalled) return;
  window.addEventListener("eip6963:announceProvider", ((event: Event) => {
    const detail = (event as CustomEvent).detail as AnnouncedDetail | undefined;
    if (detail && validProvider(detail.provider)) {
      const i = announced.findIndex(
        (a) => a.provider === detail.provider || (a.info.uuid && a.info.uuid === detail.info.uuid),
      );
      if (i >= 0) announced[i] = detail;
      else announced.push(detail);
    }
  }) as EventListener);
  listenerInstalled = true;
}

function identify(detail: AnnouncedDetail, index: number): Omit<DiscoveredWallet, "provider"> {
  const rdns = (detail.info.rdns ?? "").toLowerCase();
  const name = (detail.info.name ?? "").trim();
  if (rdns === "io.metamask" || name.toLowerCase().includes("metamask")) {
    return { id: detail.info.uuid ?? "eip6963:io.metamask", kind: "metamask", label: name || "MetaMask", icon: detail.info.icon };
  }
  if (rdns === "io.rabby" || name.toLowerCase().includes("rabby")) {
    return { id: detail.info.uuid ?? "eip6963:io.rabby", kind: "rabby", label: name || "Rabby", icon: detail.info.icon };
  }
  if (detail.provider.isRabby) {
    return { id: detail.info.uuid ?? "legacy:rabby", kind: "rabby", label: name || "Rabby", icon: detail.info.icon };
  }
  if (detail.provider.isMetaMask) {
    return { id: detail.info.uuid ?? "legacy:metamask", kind: "metamask", label: name || "MetaMask", icon: detail.info.icon };
  }
  return {
    id: detail.info.uuid ?? `wallet:${index + 1}`,
    kind: "other",
    label: name || `Dompet browser ${index + 1}`,
    icon: detail.info.icon,
  };
}

function legacyProviders(): WalletProvider[] {
  if (typeof window === "undefined") return [];
  const eth = window.ethereum;
  if (!eth) return [];
  if (Array.isArray(eth.providers) && eth.providers.length > 0) return eth.providers;
  return [eth];
}

export async function discoverWallets(timeoutMs = 750): Promise<DiscoveredWallet[]> {
  ensureListener();
  try {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  } catch {
    /* discovery best-effort */
  }
  if (timeoutMs > 0) await new Promise((r) => window.setTimeout(r, timeoutMs));
  if (announced.length > 0) {
    return announced.map((d, i) => ({ ...identify(d, i), provider: d.provider }));
  }
  return legacyProviders().map((p, i) => ({ ...identify({ info: {}, provider: p }, i), provider: p }));
}

export interface StoredSelection {
  id?: string;
  kind?: WalletKind;
  label?: string;
}

export function getStoredSelection(): StoredSelection | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SELECTION_KEY) ?? "null") as StoredSelection | null;
    if (raw && (raw.id || raw.kind || raw.label)) return raw;
  } catch {
    /* abaikan */
  }
  return null;
}

export function setStoredSelection(sel: StoredSelection) {
  localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
}

export function clearStoredSelection() {
  localStorage.removeItem(SELECTION_KEY);
}

export function matchStored(options: DiscoveredWallet[], sel: StoredSelection | null): DiscoveredWallet | null {
  if (!sel) return null;
  if (sel.id) {
    const exact = options.find((o) => o.id === sel.id);
    if (exact) return exact;
  }
  if (sel.kind && sel.kind !== "other") {
    const matches = options.filter((o) => o.kind === sel.kind);
    if (matches.length === 1) return matches[0];
  }
  if (sel.label) {
    const byLabel = options.find((o) => o.label === sel.label);
    if (byLabel) return byLabel;
  }
  return null;
}

export function friendlyError(error: unknown, fallback: string): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === 4001) return "Permintaan dibatalkan di dompet. Tidak ada transaksi yang dikirim.";
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
