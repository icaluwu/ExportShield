import { getAddress, isHash, parseEventLogs } from "viem";
import { z } from "zod";
import { requireSession } from "../../../lib/auth";
import { chainClient, escrowAddress, escrowBackendAbi, readOnchainProject } from "../../../lib/chain";
import { HttpError, json, readJson, withApi } from "../../../lib/http";

const requestSchema = z.object({ transactionHash: z.string().refine(isHash) });

type LinkRow = {
  id: string;
  submitter_address: string;
  submission_hash: `0x${string}`;
  link_status: "draft" | "linked";
  onchain_project_id: string;
  onchain_milestone_id: number;
};

export const onRequestPatch = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  const row = await env.DB.prepare(
    `SELECT s.id, s.submitter_address, s.submission_hash, s.link_status,
            p.onchain_project_id, m.onchain_milestone_id
     FROM submissions s
     JOIN projects p ON p.id = s.project_id
     JOIN milestones m ON m.id = s.milestone_id
     WHERE s.id = ?`,
  )
    .bind(String(params.id))
    .first<LinkRow>();
  if (!row) throw new HttpError(404, "SUBMISSION_NOT_FOUND", "Submission was not found");
  if (row.submitter_address !== session.walletAddress.toLowerCase()) {
    throw new HttpError(403, "SUBMITTER_ONLY", "Only the submitting wallet can link this transaction");
  }
  if (row.link_status !== "draft") {
    throw new HttpError(409, "SUBMISSION_ALREADY_LINKED", "Submission is already linked");
  }
  const parsed = requestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "INVALID_TRANSACTION_LINK", "Invalid transaction hash");

  const hash = parsed.data.transactionHash as `0x${string}`;
  const client = chainClient(env);
  const [receipt, transaction, project] = await Promise.all([
    client.getTransactionReceipt({ hash }),
    client.getTransaction({ hash }),
    readOnchainProject(env, row.onchain_project_id),
  ]);
  const contract = escrowAddress(env);
  if (
    receipt.status !== "success" ||
    !transaction.to ||
    getAddress(transaction.to) !== contract ||
    getAddress(transaction.from) !== session.walletAddress ||
    project.freelancer.toLowerCase() !== session.walletAddress.toLowerCase()
  ) {
    throw new HttpError(409, "TRANSACTION_MISMATCH", "Transaction does not belong to this freelancer and escrow");
  }
  const events = parseEventLogs({
    abi: escrowBackendAbi,
    logs: receipt.logs.filter((log) => getAddress(log.address) === contract),
    eventName: "MilestoneSubmitted",
  });
  const event = events.find(
    (candidate) =>
      candidate.args.projectId === BigInt(row.onchain_project_id) &&
      candidate.args.milestoneId === BigInt(row.onchain_milestone_id) &&
      candidate.args.submissionHash.toLowerCase() === row.submission_hash.toLowerCase(),
  );
  if (!event) {
    throw new HttpError(409, "SUBMISSION_EVENT_MISMATCH", "MilestoneSubmitted event does not match this draft");
  }
  const updated = await env.DB.prepare(
    `UPDATE submissions SET transaction_hash = ?, link_status = 'linked', updated_at = ?
     WHERE id = ? AND link_status = 'draft'`,
  )
    .bind(hash, Math.floor(Date.now() / 1000), row.id)
    .run();
  if (!updated.meta.changes) {
    throw new HttpError(409, "SUBMISSION_LINK_RACE", "Submission was linked by another request");
  }
  return json({ linked: true, transactionHash: hash });
});
