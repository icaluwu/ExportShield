import type { Address } from "viem";

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  MONAD_RPC_URL: string;
  ESCROW_CONTRACT_ADDRESS: string;
  SIGNATURE_DOMAIN: string;
  SESSION_COOKIE_SECURE?: string;
  MAX_UPLOAD_SIZE?: string;
}

export type Session = {
  idHash: string;
  walletAddress: Address;
  chainId: number;
  expiresAt: number;
};

export type ProjectRow = {
  id: string;
  chain_id: number;
  contract_address: string;
  onchain_project_id: string | null;
  client_address: string;
  freelancer_address: string;
  title: string;
  description: string;
  category: string | null;
  metadata_json: string;
  metadata_hash: string;
  creation_tx_hash: string | null;
  creation_block: number | null;
  link_status: "draft" | "linked";
  created_at: number;
  updated_at: number;
};
