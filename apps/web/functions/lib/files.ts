import { DEFAULT_MAX_UPLOAD_SIZE } from "@exportshield/shared";
import { HttpError } from "./http";
import { sha256Hex } from "./crypto";
import type { Env } from "./types";

const MIME_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/zip": "zip",
} as const;

export type AllowedMime = keyof typeof MIME_EXTENSIONS;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function hasValidMagic(bytes: Uint8Array, mime: AllowedMime): boolean {
  switch (mime) {
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    case "application/pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "application/zip":
      return (
        startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
      );
  }
}

export function maximumUploadSize(env: Env): number {
  const configured = Number(env.MAX_UPLOAD_SIZE ?? DEFAULT_MAX_UPLOAD_SIZE);
  if (!Number.isSafeInteger(configured) || configured <= 0) return DEFAULT_MAX_UPLOAD_SIZE;
  return Math.min(configured, DEFAULT_MAX_UPLOAD_SIZE);
}

export async function inspectUpload(file: File, env: Env) {
  if (file.size <= 0 || file.size > maximumUploadSize(env)) {
    throw new HttpError(413, "FILE_TOO_LARGE", "Each evidence file must be between 1 byte and 10 MB");
  }
  if (!(file.type in MIME_EXTENSIONS)) {
    throw new HttpError(415, "FILE_TYPE_NOT_ALLOWED", "Allowed file types are PNG, JPG, WEBP, PDF, and ZIP");
  }
  const mime = file.type as AllowedMime;
  const buffer = await file.arrayBuffer();
  if (!hasValidMagic(new Uint8Array(buffer.slice(0, 16)), mime)) {
    throw new HttpError(415, "FILE_SIGNATURE_INVALID", "File content does not match its declared type");
  }
  const originalName = (file.name.split(/[\\/]/).pop() ?? "evidence")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, 255);
  return {
    buffer,
    mime,
    extension: MIME_EXTENSIONS[mime],
    originalName: originalName || "evidence",
    size: file.size,
    sha256: await sha256Hex(buffer),
  };
}
