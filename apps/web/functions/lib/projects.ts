import type { Env, ProjectRow, Session } from "./types";
import { HttpError } from "./http";

export async function getProjectRow(env: Env, id: string): Promise<ProjectRow> {
  const project = await env.DB.prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first<ProjectRow>();
  if (!project) throw new HttpError(404, "PROJECT_NOT_FOUND", "Project was not found");
  return project;
}

export function requireProjectParticipant(project: ProjectRow, session: Session): void {
  const wallet = session.walletAddress.toLowerCase();
  if (project.client_address !== wallet && project.freelancer_address !== wallet) {
    throw new HttpError(403, "PROJECT_ACCESS_DENIED", "Only project participants can access this resource");
  }
}

export function serializeProject(project: ProjectRow) {
  return {
    id: project.id,
    chainId: project.chain_id,
    contractAddress: project.contract_address,
    onchainProjectId: project.onchain_project_id,
    clientAddress: project.client_address,
    freelancerAddress: project.freelancer_address,
    title: project.title,
    description: project.description,
    category: project.category,
    metadata: JSON.parse(project.metadata_json) as unknown,
    metadataHash: project.metadata_hash,
    creationTxHash: project.creation_tx_hash,
    creationBlock: project.creation_block,
    linkStatus: project.link_status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}
