import { getAddress, isHex } from "viem";
import { parseSiweMessage } from "viem/siwe";
import { z } from "zod";
import { MONAD_TESTNET_CHAIN_ID } from "@exportshield/shared";
import { chainClient } from "../../lib/chain";
import { createSession, sessionCookie, useSecureCookie } from "../../lib/auth";
import { getClientIp, HttpError, json, readJson, withApi } from "../../lib/http";
import { enforceRateLimit } from "../../lib/rate-limit";

const requestSchema = z.object({
  message: z.string().min(1).max(4_000),
  signature: z.string().refine((value) => isHex(value)),
});

export const onRequestPost = withApi(async ({ env, request }) => {
  await enforceRateLimit(env, `verify:${getClientIp(request)}`, 10, 60);
  const parsed = requestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "INVALID_SIWE_REQUEST", "Invalid SIWE payload");

  const siwe = parseSiweMessage(parsed.data.message);
  if (!siwe.address || !siwe.nonce || siwe.chainId !== MONAD_TESTNET_CHAIN_ID) {
    throw new HttpError(400, "INVALID_SIWE_MESSAGE", "SIWE message is incomplete or uses the wrong chain");
  }
  if (siwe.domain !== env.SIGNATURE_DOMAIN || siwe.uri !== `${new URL(request.url).origin}/`) {
    throw new HttpError(403, "SIWE_ORIGIN_MISMATCH", "SIWE domain or URI does not match this application");
  }
  const address = getAddress(siwe.address);
  const now = Math.floor(Date.now() / 1000);
  const nonce = await env.DB.prepare(
    "SELECT id, expires_at, used_at FROM auth_nonces WHERE nonce = ? AND wallet_address = ? AND chain_id = ?",
  )
    .bind(siwe.nonce, address.toLowerCase(), MONAD_TESTNET_CHAIN_ID)
    .first<{ id: string; expires_at: number; used_at: number | null }>();
  if (!nonce || nonce.used_at !== null || nonce.expires_at <= now) {
    throw new HttpError(401, "NONCE_INVALID", "Nonce is expired, unknown, or already used");
  }
  const valid = await chainClient(env).verifySiweMessage({
    message: parsed.data.message,
    signature: parsed.data.signature,
    domain: env.SIGNATURE_DOMAIN,
    nonce: siwe.nonce,
    time: new Date(),
  });
  if (!valid) throw new HttpError(401, "SIGNATURE_INVALID", "Wallet signature could not be verified");

  const consumed = await env.DB.prepare(
    "UPDATE auth_nonces SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?",
  )
    .bind(now, nonce.id, now)
    .run();
  if (!consumed.meta.changes) throw new HttpError(401, "NONCE_REUSED", "Nonce was already consumed");

  const session = await createSession(env, address, MONAD_TESTNET_CHAIN_ID);
  return json(
    { address, chainId: MONAD_TESTNET_CHAIN_ID, expiresAt: session.expiresAt },
    {
      headers: {
        "set-cookie": sessionCookie(session.token, session.expiresAt, useSecureCookie(env, request)),
      },
    },
  );
});
