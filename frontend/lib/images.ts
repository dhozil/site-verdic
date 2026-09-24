"use client";

// Downscale photos before hashing and sending. Phone photos (3-5 MB) make
// consensus transactions slow and heavy; a 1280px image keeps enough detail
// for the inspection prompt. The hash is computed AFTER compression, so the
// committed hash always matches the exact bytes the validators judge.

const MAX_SIDE = 1280;

function loadBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export async function compressPhoto(file: File): Promise<{ bytes: Uint8Array; buffer: ArrayBuffer }> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const keepPng = file.type === "image/png";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, keepPng ? "image/png" : "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("This browser cannot encode images.");
  const buffer = await blob.arrayBuffer();
  return { bytes: new Uint8Array(buffer), buffer };
}
