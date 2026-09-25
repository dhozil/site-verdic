"use client";

// Evidence pack: the exact compressed bytes behind a submission, portable
// across wallets. A worker exports the pack after picking photos, sends the
// JSON file through any channel, and the client imports it to inspect the
// photos before confirming. The resolver imports the same pack, so resolve
// always loads the identical hash-matching bytes. No server involved.

export interface EvidencePack {
  format: "siteverdict-evidence";
  version: 1;
  taskId: string;
  contract: string;
  beforeHash: string;
  afterHash: string;
  beforeImage: string;
  afterImage: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function buildPack(args: {
  taskId: string;
  contract: string;
  beforeHash: string;
  afterHash: string;
  before: Uint8Array;
  after: Uint8Array;
}): EvidencePack {
  return {
    format: "siteverdict-evidence",
    version: 1,
    taskId: args.taskId,
    contract: args.contract,
    beforeHash: args.beforeHash,
    afterHash: args.afterHash,
    beforeImage: bytesToBase64(args.before),
    afterImage: bytesToBase64(args.after),
  };
}

export function downloadPack(pack: EvidencePack): void {
  const blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `evidence-${pack.taskId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function parsePack(text: string): EvidencePack {
  const pack = JSON.parse(text) as EvidencePack;
  if (pack?.format !== "siteverdict-evidence" || pack?.version !== 1) {
    throw new Error("That file is not a SiteVerdict evidence pack.");
  }
  if (!pack.beforeImage || !pack.afterImage || !pack.beforeHash || !pack.afterHash) {
    throw new Error("This evidence pack is incomplete.");
  }
  return pack;
}

export function packBytes(pack: EvidencePack): { before: Uint8Array; after: Uint8Array } {
  return { before: base64ToBytes(pack.beforeImage), after: base64ToBytes(pack.afterImage) };
}

export function packPreviewUrls(pack: EvidencePack): { beforeUrl: string; afterUrl: string } {
  const { before, after } = packBytes(pack);
  return {
    beforeUrl: URL.createObjectURL(new Blob([bufferOf(before)], { type: "image/jpeg" })),
    afterUrl: URL.createObjectURL(new Blob([bufferOf(after)], { type: "image/jpeg" })),
  };
}

function bufferOf(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
