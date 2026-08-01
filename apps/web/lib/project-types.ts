export type ProjectSummary = {
  id: string;
  chainId: number;
  contractAddress: `0x${string}`;
  onchainProjectId: string | null;
  clientAddress: `0x${string}`;
  freelancerAddress: `0x${string}`;
  title: string;
  description: string;
  category: string | null;
  metadataHash: `0x${string}`;
  creationTxHash: `0x${string}` | null;
  linkStatus: "draft" | "linked";
  createdAt: number;
  updatedAt: number;
};

export type ProjectDetail = {
  project: ProjectSummary & { metadata: unknown };
  milestones: Array<{
    id: string;
    milestoneId: number;
    title: string;
    description: string | null;
    amount: string;
    dueDate: number;
  }>;
  submissions: Array<{
    id: string;
    milestoneId: number;
    submitterAddress: string;
    message: string;
    manifest: string;
    submissionHash: `0x${string}`;
    transactionHash: `0x${string}` | null;
    linkStatus: "draft" | "linked";
    createdAt: number;
  }>;
  files: Array<{ id: string; submissionId: string; fileName: string; contentType: string; fileSize: number; sha256: string }>;
};
