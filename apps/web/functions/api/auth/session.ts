import { json, withApi } from "../../lib/http";
import { requireSession } from "../../lib/auth";

export const onRequestGet = withApi(async ({ env, request }) => {
  const session = await requireSession(env, request);
  return json({
    address: session.walletAddress,
    chainId: session.chainId,
    expiresAt: session.expiresAt,
  });
});
