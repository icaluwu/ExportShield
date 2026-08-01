import {
  hashCanonicalJson,
  MONAD_TESTNET_CHAIN_ID,
  projectMetadataSchema,
} from "@exportshield/shared";
import { getAddress } from "viem";
import { requireSession } from "../../lib/auth";
import { escrowAddress } from "../../lib/chain";
import { getClientIp, HttpError, json, readJson, withApi } from "../../lib/http";
import { serializeProject } from "../../lib/projects";
import { enforceRateLimit } from "../../lib/rate-limit";
import type { ProjectRow } from "../../lib/types";

export const onRequestGet = withApi(async ({ env, request }) => {
  const session = await requireSession(env, request);
  const wallet = session.walletAddress.toLowerCase();
  const results = await env.DB.prepare(
    `SELECT * FROM projects
     WHERE client_address = ? OR freelancer_address = ?
     ORDER BY updated_at DESC LIMIT 100`,
  )
    .bind(wallet, wallet)
    .all<ProjectRow>();
  return json({ projects: results.results.map(serializeProject) });
});

export const onRequestPost = withApi(async ({ env, request }) => {
  const session = await requireSession(env, request);
  await enforceRateLimit(
    env,
    `project-create:${session.walletAddress.toLowerCase()}:${getClientIp(request)}`,
    10,
    60 * 60,
  );
  const parsed = projectMetadataSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    throw new HttpError(400, "PROJECT_VALIDATION_FAILED", "Project metadata is invalid", parsed.error.flatten());
  }
  const metadata = parsed.data;
  if (getAddress(metadata.client) !== session.walletAddress) {
    throw new HttpError(403, "CLIENT_MISMATCH", "The signed-in wallet must be the project client");
  }
  const now = Math.floor(Date.now() / 1000);
  if (metadata.deadline <= now || metadata.milestones.some((milestone) => milestone.dueDate <= now)) {
    throw new HttpError(400, "DEADLINE_IN_PAST", "Project and milestone deadlines must be in the future");
  }

  const id = crypto.randomUUID();
  const metadataHash = hashCanonicalJson(metadata);
  const contractAddress = escrowAddress(env).toLowerCase();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO projects (
        id, chain_id, contract_address, client_address, freelancer_address,
        title, description, category, metadata_json, metadata_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      MONAD_TESTNET_CHAIN_ID,
      contractAddress,
      metadata.client,
      metadata.freelancer,
      metadata.title,
      metadata.description,
      metadata.category,
      JSON.stringify(metadata),
      metadataHash,
      now,
      now,
    ),
    ...metadata.milestones.map((milestone) =>
      env.DB.prepare(
        `INSERT INTO milestones (
          id, project_id, onchain_milestone_id, title, description, amount, due_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        id,
        milestone.index,
        milestone.title,
        milestone.description,
        milestone.amount,
        milestone.dueDate,
        now,
      ),
    ),
  ];
  await env.DB.batch(statements);
  return json({ id, metadataHash, chainId: MONAD_TESTNET_CHAIN_ID, contractAddress }, { status: 201 });
});
