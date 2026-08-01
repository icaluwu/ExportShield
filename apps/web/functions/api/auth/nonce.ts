import { generateSiweNonce } from "viem/siwe";
import { getAddress } from "viem";
import { z } from "zod";
import { MONAD_TESTNET_CHAIN_ID } from "@exportshield/shared";
import { NONCE_TTL_SECONDS } from "../../lib/auth";
import { getClientIp, HttpError, json, readJson, withApi } from "../../lib/http";
import { enforceRateLimit } from "../../lib/rate-limit";

const requestSchema = z.object({
  address: z.string(),
  chainId: z.literal(MONAD_TESTNET_CHAIN_ID),
});

export const onRequestPost = withApi(async ({ env, request }) => {
  await enforceRateLimit(env, `nonce:${getClientIp(request)}`, 10, 60);
  const parsed = requestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "INVALID_AUTH_REQUEST", "Invalid wallet or chain");
  let address: string;
  try {
    address = getAddress(parsed.data.address).toLowerCase();
  } catch {
    throw new HttpError(400, "INVALID_ADDRESS", "Wallet address is invalid");
  }
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + NONCE_TTL_SECONDS;
  const nonce = generateSiweNonce();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM auth_nonces WHERE expires_at <= ? OR (wallet_address = ? AND used_at IS NULL)").bind(
      now,
      address,
    ),
    env.DB.prepare(
      "INSERT INTO auth_nonces (id, wallet_address, nonce, chain_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), address, nonce, MONAD_TESTNET_CHAIN_ID, expiresAt, now),
  ]);
  return json({
    nonce,
    expiresAt,
    domain: env.SIGNATURE_DOMAIN,
    uri: `${new URL(request.url).origin}/`,
    chainId: MONAD_TESTNET_CHAIN_ID,
  });
});
