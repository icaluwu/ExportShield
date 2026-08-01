import {
  hashCanonicalJson,
  MAX_FILES_PER_SUBMISSION,
  submissionManifestSchema,
} from "@exportshield/shared";
import { requireSession } from "../../../lib/auth";
import { readOnchainProject, chainClient, escrowAddress, escrowBackendAbi } from "../../../lib/chain";
import { inspectUpload } from "../../../lib/files";
import { getClientIp, HttpError, json, withApi } from "../../../lib/http";
import { getProjectRow } from "../../../lib/projects";
import { enforceRateLimit } from "../../../lib/rate-limit";

export const onRequestPost = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  await enforceRateLimit(
    env,
    `submission:${session.walletAddress.toLowerCase()}:${getClientIp(request)}`,
    20,
    60 * 60,
  );
  const project = await getProjectRow(env, String(params.id));
  if (project.freelancer_address !== session.walletAddress.toLowerCase()) {
    throw new HttpError(403, "FREELANCER_ONLY", "Only the assigned freelancer can submit evidence");
  }
  if (project.link_status !== "linked" || project.onchain_project_id === null) {
    throw new HttpError(409, "PROJECT_NOT_LINKED", "Project must be linked on-chain before submission");
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected multipart/form-data");
  }
  const form = await request.formData();
  const message = String(form.get("message") ?? "").trim();
  const milestoneId = Number(form.get("milestoneId"));
  if (!message || message.length > 5_000 || !Number.isInteger(milestoneId) || milestoneId < 0) {
    throw new HttpError(400, "INVALID_SUBMISSION", "Message and milestone ID are required");
  }
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length < 1 || files.length > MAX_FILES_PER_SUBMISSION) {
    throw new HttpError(400, "INVALID_FILE_COUNT", "Attach between one and three evidence files");
  }

  const chainProject = await readOnchainProject(env, project.onchain_project_id);
  if (chainProject.freelancer.toLowerCase() !== session.walletAddress.toLowerCase() || chainProject.status !== 2) {
    throw new HttpError(409, "PROJECT_NOT_ACTIVE", "On-chain project is not active for this freelancer");
  }
  if (BigInt(milestoneId) >= chainProject.milestoneCount) {
    throw new HttpError(400, "MILESTONE_NOT_FOUND", "Milestone is outside the project range");
  }
  const chainMilestone = await chainClient(env).readContract({
    address: escrowAddress(env),
    abi: escrowBackendAbi,
    functionName: "getMilestone",
    args: [BigInt(project.onchain_project_id), BigInt(milestoneId)],
  });
  if (chainMilestone.status === 2) throw new HttpError(409, "MILESTONE_PAID", "Paid milestones cannot be resubmitted");

  const milestone = await env.DB.prepare(
    "SELECT id FROM milestones WHERE project_id = ? AND onchain_milestone_id = ?",
  )
    .bind(project.id, milestoneId)
    .first<{ id: string }>();
  if (!milestone) throw new HttpError(404, "MILESTONE_NOT_FOUND", "Milestone metadata was not found");

  const submissionId = crypto.randomUUID();
  const uploadedKeys: string[] = [];
  try {
    const inspected = [];
    for (const file of files) {
      const upload = await inspectUpload(file, env);
      const id = crypto.randomUUID();
      const objectKey = `projects/${project.onchain_project_id}/milestones/${milestoneId}/${id}.${upload.extension}`;
      await env.FILES.put(objectKey, upload.buffer, {
        httpMetadata: { contentType: upload.mime },
        customMetadata: {
          submissionId,
          sha256: upload.sha256,
        },
      });
      uploadedKeys.push(objectKey);
      inspected.push({ id, objectKey, ...upload });
    }
    const manifest = submissionManifestSchema.parse({
      version: 1,
      projectId: project.onchain_project_id,
      milestoneId,
      submitter: session.walletAddress,
      message,
      files: inspected.map((file) => ({
        id: file.id,
        originalName: file.originalName,
        mime: file.mime,
        size: file.size,
        sha256: file.sha256,
      })),
    });
    const submissionHash = hashCanonicalJson(manifest);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO submissions (
          id, project_id, milestone_id, submitter_address, message, manifest_json,
          submission_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        submissionId,
        project.id,
        milestone.id,
        session.walletAddress.toLowerCase(),
        message,
        JSON.stringify(manifest),
        submissionHash,
        now,
        now,
      ),
      ...inspected.map((file) =>
        env.DB.prepare(
          `INSERT INTO submission_files (
            id, submission_id, object_key, file_name, content_type, file_size, sha256, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          file.id,
          submissionId,
          file.objectKey,
          file.originalName,
          file.mime,
          file.size,
          file.sha256,
          now,
        ),
      ),
    ]);
    return json(
      { id: submissionId, submissionHash, manifest, linkStatus: "draft" as const },
      { status: 201 },
    );
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => env.FILES.delete(key)));
    throw error;
  }
});
