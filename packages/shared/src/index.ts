import { keccak256, toBytes, type Address, type Hex } from "viem";
import { z } from "zod";

export const MONAD_TESTNET_CHAIN_ID = 10143;
export const MAX_MILESTONES = 10;
export const MAX_FILES_PER_SUBMISSION = 3;
export const DEFAULT_MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
  .transform((value) => value.toLowerCase() as Address);

const unixSecondsSchema = z.number().int().positive();
const baseUnitAmountSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/, "Amount must be a positive base-unit integer");

export const milestoneMetadataSchema = z.object({
  index: z.number().int().min(0).max(MAX_MILESTONES - 1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000).nullable(),
  amount: baseUnitAmountSchema,
  dueDate: unixSecondsSchema,
});

export const projectMetadataSchema = z
  .object({
    version: z.literal(1),
    client: addressSchema,
    freelancer: addressSchema,
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(5_000),
    category: z.string().trim().max(80).nullable(),
    deadline: unixSecondsSchema,
    milestones: z.array(milestoneMetadataSchema).min(1).max(MAX_MILESTONES),
  })
  .superRefine((project, context) => {
    if (project.client === project.freelancer) {
      context.addIssue({
        code: "custom",
        path: ["freelancer"],
        message: "Client and freelancer must be different wallets",
      });
    }
    for (const [index, milestone] of project.milestones.entries()) {
      if (milestone.index !== index) {
        context.addIssue({
          code: "custom",
          path: ["milestones", index, "index"],
          message: "Milestone indexes must be sequential",
        });
      }
      if (milestone.dueDate > project.deadline) {
        context.addIssue({
          code: "custom",
          path: ["milestones", index, "dueDate"],
          message: "Milestone deadline cannot exceed project deadline",
        });
      }
    }
  });

export const submissionFileSchema = z.object({
  id: z.string().uuid(),
  originalName: z.string().min(1).max(255),
  mime: z.enum([
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
    "application/zip",
  ]),
  size: z.number().int().positive().max(DEFAULT_MAX_UPLOAD_SIZE),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export const submissionManifestSchema = z.object({
  version: z.literal(1),
  projectId: z.string().regex(/^(0|[1-9][0-9]*)$/),
  milestoneId: z.number().int().min(0).max(MAX_MILESTONES - 1),
  submitter: addressSchema,
  message: z.string().trim().min(1).max(5_000),
  files: z.array(submissionFileSchema).min(1).max(MAX_FILES_PER_SUBMISSION),
});

export type ProjectMetadataV1 = z.infer<typeof projectMetadataSchema>;
export type MilestoneMetadataV1 = z.infer<typeof milestoneMetadataSchema>;
export type SubmissionManifestV1 = z.infer<typeof submissionManifestSchema>;

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: ApiError };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function hashCanonicalJson(value: unknown): Hex {
  return keccak256(toBytes(canonicalJson(value)));
}

export function parseProjectMetadata(input: unknown): ProjectMetadataV1 {
  return projectMetadataSchema.parse(input);
}

export function parseSubmissionManifest(input: unknown): SubmissionManifestV1 {
  return submissionManifestSchema.parse(input);
}
