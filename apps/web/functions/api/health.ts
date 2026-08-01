import { chainClient } from "../lib/chain";
import { json, withApi } from "../lib/http";

export const onRequestGet = withApi(async ({ env }) => {
  const checks = await Promise.allSettled([
    env.DB.prepare("SELECT 1 AS ok").first(),
    chainClient(env).getChainId(),
  ]);
  const database = checks[0]?.status === "fulfilled";
  const rpc = checks[1]?.status === "fulfilled" && checks[1].value === 10143;
  const storage = typeof env.FILES?.get === "function";
  const healthy = database && rpc && storage;
  return json(
    { status: healthy ? "ok" : "degraded", checks: { database, storage, rpc } },
    { status: healthy ? 200 : 503 },
  );
});
