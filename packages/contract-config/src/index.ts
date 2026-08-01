import type { Abi, Address } from "viem";
import addresses from "./addresses/monad-testnet.json" with { type: "json" };

export type DeploymentAddresses = {
  chainId: number;
  escrow: Address | null;
  mockUsdc: Address | null;
  deploymentBlock: number | null;
  verificationUrl: string | null;
};

export const monadTestnetDeployment = addresses as DeploymentAddresses;

export const mockUsdcAbi = [
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const satisfies Abi;

export const milestoneEscrowAbi = [
  {
    type: "function",
    name: "createProject",
    stateMutability: "nonpayable",
    inputs: [
      { name: "freelancer", type: "address" },
      { name: "deadline", type: "uint64" },
      { name: "metadataHash", type: "bytes32" },
      { name: "milestoneAmounts", type: "uint96[]" },
      { name: "milestoneDeadlines", type: "uint64[]" },
    ],
    outputs: [{ name: "projectId", type: "uint256" }],
  },
  ...["fundProject", "acceptProject", "approveMilestone", "refundUnacceptedProject"].map(
    (name) => ({
      type: "function" as const,
      name,
      stateMutability: "nonpayable" as const,
      inputs:
        name === "approveMilestone"
          ? [
              { name: "projectId", type: "uint256" },
              { name: "milestoneId", type: "uint256" },
            ]
          : [{ name: "projectId", type: "uint256" }],
      outputs: [],
    }),
  ),
  {
    type: "function",
    name: "submitMilestone",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "milestoneId", type: "uint256" },
      { name: "submissionHash", type: "bytes32" },
    ],
    outputs: [],
  },
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
] as const satisfies Abi;
