import { getAddress, parseEventLogs } from "viem";
import { isHash } from "viem";
import { z } from "zod";
import { requireSession } from "../../../lib/auth";
import { chainClient, escrowAddress, escrowBackendAbi } from "../../../lib/chain";
import { HttpError, json, readJson, withApi } from "../../../lib/http";
import { getProjectRow } from "../../../lib/projects";

const requestSchema = z.object({
  transactionHash: z.string().refine(isHash),
  onchainProjectId: z.string().regex(/^(0|[1-9][0-9]*)$/),
});

export const onRequestPatch = withApi(async ({ env, request, params }) => {
  const session = await requireSession(env, request);
  const project = await getProjectRow(env, String(params.id));
  if (project.client_address !== session.walletAddress.toLowerCase()) {
    throw new HttpError(403, "CLIENT_ONLY", "Only the project client can link its transaction");
  }
  if (project.link_status !== "draft") {
    throw new HttpError(409, "PROJECT_ALREADY_LINKED", "Project is already linked on-chain");
  }
  const parsed = requestSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new HttpError(400, "INVALID_TRANSACTION_LINK", "Invalid transaction link payload");

  const client = chainClient(env);
  const hash = parsed.data.transactionHash as `0x${string}`;
  const [receipt, transaction] = await Promise.all([
    client.getTransactionReceipt({ hash }),
    client.getTransaction({ hash }),
  ]);
  const contract = escrowAddress(env);
  if (
    receipt.status !== "success" ||
    !transaction.to ||
    getAddress(transaction.to) !== contract ||
    getAddress(transaction.from) !== session.walletAddress
  ) {
    throw new HttpError(409, "TRANSACTION_MISMATCH", "Transaction sender, target, or status is invalid");
  }
  const events = parseEventLogs({
    abi: escrowBackendAbi,
    logs: receipt.logs.filter((log) => getAddress(log.address) === contract),
    eventName: "ProjectCreated",
  });
  const expectedId = BigInt(parsed.data.onchainProjectId);
  const totalAmount = (await env.DB.prepare("SELECT amount FROM milestones WHERE project_id = ?")
    .bind(project.id)
    .all<{ amount: string }>()).results.reduce((sum, row) => sum + BigInt(row.amount), 0n);
  const event = events.find(
    (candidate) =>
      candidate.args.projectId === expectedId &&
      candidate.args.client.toLowerCase() === project.client_address &&
      candidate.args.freelancer.toLowerCase() === project.freelancer_address &&
      candidate.args.totalAmount === totalAmount &&
      candidate.args.metadataHash.toLowerCase() === project.metadata_hash,
  );
  if (!event) throw new HttpError(409, "PROJECT_EVENT_MISMATCH", "ProjectCreated event does not match the draft");

  const updated = await env.DB.prepare(
    `UPDATE projects SET onchain_project_id = ?, creation_tx_hash = ?, creation_block = ?,
      link_status = 'linked', updated_at = ? WHERE id = ? AND link_status = 'draft'`,
  )
    .bind(
      parsed.data.onchainProjectId,
      hash,
      Number(receipt.blockNumber),
      Math.floor(Date.now() / 1000),
      project.id,
    )
    .run();
  if (!updated.meta.changes) throw new HttpError(409, "PROJECT_LINK_RACE", "Project was linked by another request");
  return json({ linked: true, onchainProjectId: parsed.data.onchainProjectId, transactionHash: hash });
});
