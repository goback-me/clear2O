"use client";

import { CLIENT_TARGET_BYTES } from "@/lib/schema";

const MAX_DIMENSION = 2200;

/**
 * Downscales and re-encodes an image in the browser before upload so large
 * phone photos don't blow past the server's request-size limit. Falls back
 * to the original file if compression fails for any reason (server still
 * enforces the hard size cap independently).
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.9;
    let blob = await canvasToBlob(canvas, quality);

    while (blob && blob.size > CLIENT_TARGET_BYTES && quality > 0.4) {
      quality -= 0.15;
      blob = await canvasToBlob(canvas, quality);
    }

    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
