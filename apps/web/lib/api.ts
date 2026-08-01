import type { ApiResponse } from "@exportshield/shared";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || "error" in payload) {
    const error = "error" in payload ? payload.error : { code: "HTTP_ERROR", message: response.statusText };
    throw new ApiClientError(response.status, error.code, error.message, error.details);
  }
  return payload.data;
}

export function compactAddress(address: string, size = 4): string {
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function explorerTx(hash: string): string {
  const base = process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "https://testnet.monadexplorer.com";
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}
