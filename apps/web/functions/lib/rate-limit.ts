import type { Env } from "./types";
import { HttpError } from "./http";

export async function enforceRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const expiresAt = (bucket + 1) * windowSeconds;
  await env.DB.prepare(
    `INSERT INTO rate_limits (rate_key, bucket, request_count, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(rate_key, bucket) DO UPDATE SET request_count = request_count + 1`,
  )
    .bind(key, bucket, expiresAt)
    .run();
  const row = await env.DB.prepare(
    "SELECT request_count FROM rate_limits WHERE rate_key = ? AND bucket = ?",
  )
    .bind(key, bucket)
    .first<{ request_count: number }>();
  if ((row?.request_count ?? 0) > limit) {
    throw new HttpError(429, "RATE_LIMITED", "Too many requests. Try again shortly.", {
      retryAfter: expiresAt - now,
    });
  }
}
