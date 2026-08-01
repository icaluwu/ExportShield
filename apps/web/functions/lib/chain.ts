import { defineChain, http, createPublicClient, getAddress, type Address } from "viem";
import { MONAD_TESTNET_CHAIN_ID } from "@exportshield/shared";
import type { Env } from "./types";
import { HttpError } from "./http";

export const escrowBackendAbi = [
  {
    type: "function",
    name: "getProject",
    stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "freelancer", type: "address" },
          { name: "totalAmount", type: "uint96" },
          { name: "releasedAmount", type: "uint96" },
          { name: "createdAt", type: "uint64" },
          { name: "fundedAt", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "milestoneCount", type: "uint32" },
          { name: "status", type: "uint8" },
          { name: "metadataHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getMilestone",
    stateMutability: "view",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "milestoneId", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "uint96" },
          { name: "dueDate", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "submissionHash", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "ProjectCreated",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "freelancer", type: "address", indexed: true },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "metadataHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MilestoneSubmitted",
    inputs: [
      { name: "projectId", type: "uint256", indexed: true },
      { name: "milestoneId", type: "uint256", indexed: true },
      { name: "submissionHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export function chainClient(env: Env) {
  const monadTestnet = defineChain({
    id: MONAD_TESTNET_CHAIN_ID,
    name: "Monad Testnet",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    rpcUrls: { default: { http: [env.MONAD_RPC_URL] } },
  });
  return createPublicClient({ chain: monadTestnet, transport: http(env.MONAD_RPC_URL) });
}

export function escrowAddress(env: Env): Address {
  try {
    return getAddress(env.ESCROW_CONTRACT_ADDRESS);
  } catch {
    throw new HttpError(503, "CONTRACT_NOT_CONFIGURED", "Escrow contract is not configured");
  }
}

export async function readOnchainProject(env: Env, projectId: string) {
  try {
    return await chainClient(env).readContract({
      address: escrowAddress(env),
      abi: escrowBackendAbi,
      functionName: "getProject",
      args: [BigInt(projectId)],
    });
  } catch {
    throw new HttpError(502, "RPC_READ_FAILED", "Unable to verify the project on-chain");
  }
}
