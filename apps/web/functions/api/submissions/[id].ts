import { requireSession } from "../../lib/auth";
import { readOnchainProject } from "../../lib/chain";
import { HttpError, json, withApi } from "../../lib/http";

type SubmissionAccessRow = {
  id: string;
  submitter_address: string;
  link_status: "draft" | "linked";
  client_address: string;
  freelancer_address: string;
  onchain_project_id: string | null;
};

export const onRequestDelete = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  const id = String(params.id);
  const submission = await env.DB.prepare(
    `SELECT s.id, s.submitter_address, s.link_status, p.client_address, p.freelancer_address,
            p.onchain_project_id
     FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ?`,
  )
    .bind(id)
    .first<SubmissionAccessRow>();
  if (!submission) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission was not found");
  if (submission.submitter_address !== session.walletAddress.toLowerCase()) {
    throw new HttpError(403, "SUBMITTER_ONLY", "Only the submitting wallet can delete this draft");
  }
  if (submission.onchain_project_id === null) {
    throw new HttpError(409, "PROJECT_NOT_LINKED", "Project is not linked on-chain");
  }
  const liveProject = await readOnchainProject(env, submission.onchain_project_id);
  if (liveProject.freelancer.toLowerCase() !== session.walletAddress.toLowerCase()) {
    throw new HttpError(403, "ONCHAIN_ROLE_MISMATCH", "Wallet is not the live on-chain freelancer");
  }
  if (submission.link_status !== "draft") {
    throw new HttpError(409, "SUBMISSION_ALREADY_LINKED", "Linked submissions cannot be deleted");
  }
  const files = await env.DB.prepare("SELECT object_key FROM submission_files WHERE submission_id = ?")
    .bind(id)
    .all<{ object_key: string }>();
  await Promise.all(files.results.map((file) => env.FILES.delete(file.object_key)));
  await env.DB.prepare("DELETE FROM submissions WHERE id = ?").bind(id).run();
  return json({ deleted: true });
});
