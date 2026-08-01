import { getAddress, type Address } from "viem";
import type { Env, Session } from "./types";
import { HttpError } from "./http";
import { randomToken, sha256Hex } from "./crypto";

export const SESSION_COOKIE = "exportshield_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const NONCE_TTL_SECONDS = 5 * 60;

function parseCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export async function requireSession(env: Env, request: Request): Promise<Session> {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) throw new HttpError(401, "AUTH_REQUIRED", "Sign in with your wallet to continue");
  const idHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    "SELECT id_hash, wallet_address, chain_id, expires_at FROM sessions WHERE id_hash = ? AND expires_at > ?",
  )
    .bind(idHash, now)
    .first<{ id_hash: string; wallet_address: string; chain_id: number; expires_at: number }>();
  if (!row) throw new HttpError(401, "SESSION_EXPIRED", "Your wallet session has expired");
  return {
    idHash: row.id_hash,
    walletAddress: getAddress(row.wallet_address),
    chainId: row.chain_id,
    expiresAt: row.expires_at,
  };
}

export async function createSession(env: Env, walletAddress: Address, chainId: number) {
  const token = randomToken();
  const idHash = await sha256Hex(token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  await env.DB.prepare(
    "INSERT INTO sessions (id_hash, wallet_address, chain_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(idHash, walletAddress.toLowerCase(), chainId, expiresAt, now)
    .run();
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: number, secure: boolean): string {
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

export function useSecureCookie(env: Env, request: Request): boolean {
  return env.SESSION_COOKIE_SECURE === "true" || new URL(request.url).protocol === "https:";
}

export async function deleteRequestSession(env: Env, request: Request): Promise<void> {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256Hex(token)).run();
}
