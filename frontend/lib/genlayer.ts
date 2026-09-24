import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import { CONTRACT_ADDRESS } from "./config";
import { recordTx } from "./journal";
import type { WalletProvider } from "./wallets";

let readClient: ReturnType<typeof createClient> | null = null;
let writeClient: ReturnType<typeof createClient> | null = null;
let boundProvider: WalletProvider | null = null;
let boundAccount: string | null = null;

export function getClient() {
  if (!readClient) {
    readClient = createClient({ chain: studionet });
  }
  return readClient;
}

/** Client tulis terikat ke provider + alamat dompet yang dipilih pengguna. */
export function getWriteClient(provider: WalletProvider, account: string) {
  if (!writeClient || boundProvider !== provider || boundAccount !== account) {
    writeClient = createClient({
      chain: studionet,
      provider: provider as never,
      account: account as `0x${string}`,
    });
    boundProvider = provider;
    boundAccount = account;
  }
  return writeClient;
}

export interface EvidenceRecord {
  proof_hash: string;
  before_hash: string;
  verdict: { approved?: boolean; confidence?: number; reasoning?: string };
}

export interface TaskView {
  id: string;
  creator: string;
  worker: string;
  description: string;
  requirements: string;
  reward_atto: string;
  status: string;
  proof_hash: string;
  before_hash: string;
  baseline_hash: string;
  verdict: string;
  appeals_used: string;
  evidence_history: EvidenceRecord[];
}

export interface ConsensusSummary {
  leadersTotal: number;
  leadersOk: number;
  validatorsTotal: number;
  validatorsOk: number;
}

export interface TxUpdate {
  message: string;
  isError: boolean;
  hash?: string;
  phase?: "signed" | "accepted" | "finalized";
  consensus?: ConsensusSummary;
}

function summarizeConsensus(receipt: unknown): ConsensusSummary | undefined {
  if (typeof receipt !== "object" || receipt === null) return undefined;
  const cd = (receipt as { consensus_data?: unknown }).consensus_data;
  if (typeof cd !== "object" || cd === null) return undefined;
  const bag = cd as Record<string, unknown>;
  const leaders = Array.isArray(bag.leader_receipt) ? bag.leader_receipt : [];
  const rawValidators = Array.isArray(bag.validator_receipts)
    ? bag.validator_receipts
    : Array.isArray(bag.validators)
      ? bag.validators
      : [];
  const ok = (r: unknown) =>
    typeof r === "object" && r !== null &&
    (r as { execution_result?: unknown }).execution_result === "SUCCESS";
  return {
    leadersTotal: leaders.length,
    leadersOk: leaders.filter(ok).length,
    validatorsTotal: rawValidators.length,
    validatorsOk: rawValidators.filter(ok).length,
  };
}

export function addrOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const obj = value as Record<string, unknown>;
  const inner = obj.as_hex ?? obj.address;
  return typeof inner === "string" ? inner : String(value);
}

export function shortAddr(value: unknown): string {
  const a = addrOf(value);
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function isUnassignedWorker(value: unknown): boolean {
  const a = addrOf(value);
  return a === "" || a.toLowerCase() === ZERO_ADDRESS;
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function readTaskIds(): Promise<string[]> {
  const ids = await getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_tasks",
    args: [],
  });
  return (ids ?? []) as string[];
}

export async function readTask(id: string): Promise<TaskView> {
  const raw = (await getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_task",
    args: [id],
  })) as Record<string, unknown>;
  const workerAddr = addrOf(raw.worker);
  return {
    id,
    creator: addrOf(raw.creator),
    worker: isUnassignedWorker(workerAddr) ? "" : workerAddr,
    description: String(raw.description ?? ""),
    requirements: String(raw.requirements ?? ""),
    reward_atto: String(raw.reward_atto ?? "0"),
    status: String(raw.status ?? ""),
    proof_hash: String(raw.proof_hash ?? ""),
    before_hash: String(raw.before_hash ?? ""),
    baseline_hash: String(raw.baseline_hash ?? ""),
    verdict: String(raw.verdict ?? ""),
    appeals_used: String(raw.appeals_used ?? "0"),
    evidence_history: Array.isArray(raw.evidence_history)
      ? (raw.evidence_history as EvidenceRecord[])
      : [],
  };
}

function asAddressArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && /^0x[0-9a-fA-F]{40}$/.test(item),
  );
}

export async function requestAccounts(provider: WalletProvider): Promise<string> {
  const accounts = asAddressArray(await provider.request({ method: "eth_requestAccounts" }));
  if (accounts.length === 0) throw new Error("Tidak ada akun yang disetujui. Pilih akun lalu coba lagi.");
  return accounts[0];
}

/** Paksa dompet terpilih ke studionet (chain 61999), tambah jika belum ada. */
export async function ensureStudionet(provider: WalletProvider): Promise<void> {
  const expected = `0x${studionet.id.toString(16)}`;
  const current = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (current === expected) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expected }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: expected,
            chainName: studionet.name,
            rpcUrls: [...studionet.rpcUrls.default.http],
            nativeCurrency: { ...studionet.nativeCurrency },
            blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
          },
        ],
      });
    } else {
      throw error;
    }
  }
  const verified = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (verified !== expected) throw new Error("Pindahkan dompet ke Genlayer Studio Network lalu coba lagi.");
}

function extractRevertReason(receipt: unknown): string | null {
  try {
    const cd = (receipt as { consensus_data?: { leader_receipt?: unknown[] } }).consensus_data;
    const leaders = cd?.leader_receipt ?? [];
    for (const lr of leaders) {
      const g = (lr as { genvm_result?: { stderr?: unknown; stdout?: unknown } }).genvm_result;
      const text = `${g?.stderr ?? ""}\n${g?.stdout ?? ""}`;
      const m = text.match(/\[EXPECTED\]\s*([^\n]+)/);
      if (m) return m[1].trim();
      const e = (lr as { error?: unknown }).error;
      if (typeof e === "string" && e) return e;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function sendWrite(
  provider: WalletProvider,
  account: string,
  method: string,
  args: unknown[],
  onUpdate: (update: TxUpdate) => void,
): Promise<void> {
  onUpdate({ message: `Waiting for the wallet to sign ${method}...`, isError: false });
  const hash = await getWriteClient(provider, account).writeContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args: args as never[],
    value: BigInt(0),
  });
  const short = hash.slice(0, 12);
  onUpdate({
    message: `Sent (${short}...). Waiting for the network to accept it...`,
    isError: false,
    hash,
    phase: "signed",
  });
  await getClient().waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  onUpdate({
    message: `Accepted (${short}...). Validators are now deciding. This takes about a minute for AI verdicts...`,
    isError: false,
    hash,
    phase: "accepted",
  });
  const receipt = (await getClient().waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
  })) as unknown as {
    consensus_data?: { leader_receipt?: { execution_result?: string }[] };
  };
  const consensus = summarizeConsensus(receipt);
  const ok = receipt?.consensus_data?.leader_receipt?.[0]?.execution_result === "SUCCESS";
  if (!ok) {
    const reason = extractRevertReason(receipt);
    onUpdate({
      message: reason
        ? `Execution failed: ${reason}. No state changed.`
        : "Execution failed. No state changed.",
      isError: true,
      hash,
      phase: "finalized",
      consensus,
    });
    throw new Error(reason ? `execution failed: ${reason}` : "execution failed");
  }
  onUpdate({ message: "Finalized. Verify the new status in the details below.", isError: false, hash, phase: "finalized", consensus });
  if (typeof args[0] === "string") {
    let chainTime: number | undefined;
    try {
      const blockNo = (receipt as { blockNumber?: unknown }).blockNumber;
      const n = typeof blockNo === "bigint" ? blockNo : BigInt(String(blockNo ?? ""));
      const block = (await getClient().getBlock({ blockNumber: n })) as unknown as {
        timestamp?: unknown;
      };
      const t = block?.timestamp;
      chainTime = typeof t === "bigint" ? Number(t) : Number(t ?? NaN);
      if (Number.isNaN(chainTime)) chainTime = undefined;
    } catch {
      /* device time remains the fallback */
    }
    recordTx(args[0], method, hash, chainTime);
  }
}
