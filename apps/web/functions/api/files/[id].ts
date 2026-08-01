import { requireSession } from "../../lib/auth";
import { readOnchainProject } from "../../lib/chain";
import { getClientIp, HttpError, withApi } from "../../lib/http";
import { enforceRateLimit } from "../../lib/rate-limit";

type FileAccessRow = {
  object_key: string;
  file_name: string;
  content_type: string;
  client_address: string;
  freelancer_address: string;
  onchain_project_id: string | null;
};

export const onRequestGet = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  await enforceRateLimit(env, `file:${session.walletAddress.toLowerCase()}:${getClientIp(request)}`, 120, 60 * 60);
  const row = await env.DB.prepare(
    `SELECT f.object_key, f.file_name, f.content_type, p.client_address, p.freelancer_address,
            p.onchain_project_id
     FROM submission_files f
     JOIN submissions s ON s.id = f.submission_id
     JOIN projects p ON p.id = s.project_id
     WHERE f.id = ?`,
  )
    .bind(String(params.id))
    .first<FileAccessRow>();
  if (!row) throw new HttpError(404, "FILE_NOT_FOUND", "Evidence file was not found");
  const wallet = session.walletAddress.toLowerCase();
  if (wallet !== row.client_address && wallet !== row.freelancer_address) {
    throw new HttpError(403, "FILE_ACCESS_DENIED", "Only project participants can access evidence files");
  }
  if (row.onchain_project_id === null) {
    throw new HttpError(409, "PROJECT_NOT_LINKED", "Evidence is not linked to an on-chain project");
  }
  const liveProject = await readOnchainProject(env, row.onchain_project_id);
  if (wallet !== liveProject.client.toLowerCase() && wallet !== liveProject.freelancer.toLowerCase()) {
    throw new HttpError(403, "ONCHAIN_ROLE_MISMATCH", "Wallet is not a live on-chain project participant");
  }
  const object = await env.FILES.get(row.object_key);
  if (!object) throw new HttpError(404, "FILE_NOT_FOUND", "Evidence object is unavailable");
  const disposition = row.content_type === "application/zip" ? "attachment" : "inline";
  const headers = new Headers({
    "content-type": row.content_type,
    "content-length": String(object.size),
    "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  });
  return new Response(object.body, { headers });
});
