import { describe, expect, it } from "vitest";
import { readJson, withApi } from "../functions/lib/http";
import type { Env } from "../functions/lib/types";

function context(request: Request) {
  return { request, env: {} as Env, params: {}, data: {}, functionPath: "", waitUntil() {}, next: async () => new Response() } as unknown as EventContext<Env, string, Record<string, unknown>>;
}

describe("API boundary", () => {
  it("rejects cross-origin mutations", async () => {
    const handler = withApi(async () => new Response("ok"));
    const response = await handler(context(new Request("https://app.example/api/test", { method: "POST", headers: { origin: "https://evil.example" } })));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVALID_ORIGIN" } });
  });

  it("rejects non-JSON bodies before parsing", async () => {
    await expect(readJson(new Request("https://app.example/api/test", { method: "POST", body: "hello", headers: { "content-type": "text/plain" } }))).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
  });
});
