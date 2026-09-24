"use client";

// Downscale photos before hashing and sending. Phone photos (3-5 MB) make
// consensus transactions slow and heavy, and the Studio endpoint rejects
// bodies above ~1 MB (HTTP 413). Every photo is re-encoded as JPEG and kept
// under 800 KB through quality and size fallbacks. The hash is computed
// AFTER compression, so the committed hash always matches the exact bytes
// the validators judge.

const MAX_SIDE = 1280;
const MAX_BYTES = 800_000;

async function encode(
  bitmap: ImageBitmap,
  maxSide: number,
  quality: number,
): Promise<{ bytes: Uint8Array; buffer: ArrayBuffer } | null> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return null;
  const buffer = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buffer), buffer };
}

export async function compressPhoto(file: File): Promise<{ bytes: Uint8Array; buffer: ArrayBuffer }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file is not a readable photo. Use a PNG or JPEG photo.");
  }
  try {
    for (const [side, quality] of [
      [MAX_SIDE, 0.85],
      [MAX_SIDE, 0.7],
      [960, 0.7],
    ] as const) {
      const out = await encode(bitmap, side, quality);
      if (out && out.bytes.length <= MAX_BYTES) return out;
    }
    throw new Error("That photo is still too large after compression. Try a smaller file.");
  } finally {
    bitmap.close();
  }
}
