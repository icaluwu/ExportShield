import { requireSession } from "../../lib/auth";
import { HttpError, json, withApi } from "../../lib/http";
import { getProjectRow, requireProjectParticipant, serializeProject } from "../../lib/projects";

export const onRequestGet = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  const project = await getProjectRow(env, String(params.id));
  requireProjectParticipant(project, session);
  const milestones = await env.DB.prepare(
    `SELECT id, onchain_milestone_id AS milestoneId, title, description, amount, due_date AS dueDate
     FROM milestones WHERE project_id = ? ORDER BY onchain_milestone_id`,
  )
    .bind(project.id)
    .all();
  const submissions = await env.DB.prepare(
    `SELECT s.id, m.onchain_milestone_id AS milestoneId, s.submitter_address AS submitterAddress,
            s.message, s.manifest_json AS manifest, s.submission_hash AS submissionHash,
            s.transaction_hash AS transactionHash, s.link_status AS linkStatus, s.created_at AS createdAt
     FROM submissions s JOIN milestones m ON m.id = s.milestone_id
     WHERE s.project_id = ? ORDER BY s.created_at DESC`,
  )
    .bind(project.id)
    .all();
  const files = await env.DB.prepare(
    `SELECT f.id, f.submission_id AS submissionId, f.file_name AS fileName,
            f.content_type AS contentType, f.file_size AS fileSize, f.sha256
     FROM submission_files f JOIN submissions s ON s.id = f.submission_id
     WHERE s.project_id = ? ORDER BY f.created_at`,
  ).bind(project.id).all();
  return json({ project: serializeProject(project), milestones: milestones.results, submissions: submissions.results, files: files.results });
});

export const onRequestDelete = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  const project = await getProjectRow(env, String(params.id));
  if (project.client_address !== session.walletAddress.toLowerCase()) {
    throw new HttpError(403, "CLIENT_ONLY", "Only the project client can delete this draft");
  }
  if (project.link_status !== "draft") {
    throw new HttpError(409, "PROJECT_ALREADY_LINKED", "Linked projects cannot be deleted off-chain");
  }
  await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(project.id).run();
  return json({ deleted: true });
});
