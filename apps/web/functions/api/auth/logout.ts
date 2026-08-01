import { clearSessionCookie, deleteRequestSession, useSecureCookie } from "../../lib/auth";
import { json, withApi } from "../../lib/http";

export const onRequestPost = withApi(async ({ env, request }) => {
  await deleteRequestSession(env, request);
  return json(
    { signedOut: true },
    { headers: { "set-cookie": clearSessionCookie(useSecureCookie(env, request)) } },
  );
});
