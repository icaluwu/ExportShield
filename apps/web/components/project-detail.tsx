"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatUnits, parseEventLogs, type Address, type Hash } from "viem";
import { useRouter } from "next/navigation";
import type { ProjectMetadataV1 } from "@exportshield/shared";
import { useAccount, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { ExternalLink, FileUp, RefreshCw } from "lucide-react";
import { apiRequest, compactAddress, explorerTx } from "@/lib/api";
import { contractAddresses, contractsConfigured } from "@/lib/app-config";
import { MILESTONE_STATUS, milestoneEscrowAbi, mockUsdcAbi, PROJECT_STATUS } from "@/lib/contracts";
import type { ProjectDetail } from "@/lib/project-types";

type ChainProject = { client: Address; freelancer: Address; totalAmount: bigint; releasedAmount: bigint; fundedAt: bigint; deadline: bigint; milestoneCount: number; status: number; metadataHash: Hash };
type ChainMilestone = { amount: bigint; dueDate: bigint; status: number; submissionHash: Hash };

export function ProjectDetailView({ id }: { id: string }) {
  const account = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const detail = useQuery({ queryKey: ["project", id], queryFn: () => apiRequest<ProjectDetail>(`/api/projects/${id}`) });
  const onchainId = detail.data?.project.onchainProjectId ? BigInt(detail.data.project.onchainProjectId) : undefined;
  const chainProjectRead = useReadContract({ address: contractAddresses.escrow ?? undefined, abi: milestoneEscrowAbi, functionName: "getProject", args: onchainId === undefined ? undefined : [onchainId], query: { enabled: Boolean(onchainId !== undefined && contractAddresses.escrow), refetchInterval: 10_000 } });
  const milestoneReads = useReadContracts({ contracts: (detail.data?.milestones ?? []).map((m) => ({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "getMilestone" as const, args: [onchainId!, BigInt(m.milestoneId)] as const })), query: { enabled: Boolean(onchainId !== undefined && contractAddresses.escrow), refetchInterval: 10_000 } });
  const project = chainProjectRead.data as ChainProject | undefined;
  const chainMilestones = milestoneReads.data?.map((item) => item.status === "success" ? item.result as ChainMilestone : undefined) ?? [];
  const allowance = useReadContract({ address: contractAddresses.mockUsdc ?? undefined, abi: mockUsdcAbi, functionName: "allowance", args: account.address && contractAddresses.escrow ? [account.address, contractAddresses.escrow] : undefined, query: { enabled: Boolean(project && account.address && contractAddresses.mockUsdc && contractAddresses.escrow), refetchInterval: 10_000 } });

  async function confirm(label: string, request: () => Promise<Hash>) {
    setError(undefined); setStatus(`${label}: confirm in your wallet…`);
    try { const hash = await request(); setStatus(`${label}: transaction submitted…`); const receipt = await publicClient!.waitForTransactionReceipt({ hash }); if (receipt.status !== "success") throw new Error("The transaction reverted"); setStatus(`${label}: confirmed.`); await Promise.all([chainProjectRead.refetch(), milestoneReads.refetch(), allowance.refetch()]); return hash; } catch (cause) { setStatus(undefined); setError(cause instanceof Error ? cause.message : `${label} failed`); throw cause; }
  }

  if (detail.isPending) return <div className="skeleton-card" />;
  if (detail.isError) return <div className="status-line error-line" role="alert">{detail.error.message}</div>;
  const data = detail.data;
  const isClient = account.address?.toLowerCase() === data.project.clientAddress;
  const isFreelancer = account.address?.toLowerCase() === data.project.freelancerAddress;
  const chainReady = data.project.linkStatus === "linked" && onchainId !== undefined && project;

  async function resumeProjectDraft() {
    if (!publicClient || !contractAddresses.escrow) return;
    const metadata = data.project.metadata as ProjectMetadataV1;
    setError(undefined); setStatus("Resume draft: confirm createProject in your wallet…");
    try {
      const hash = await write.writeContractAsync({ address: contractAddresses.escrow, abi: milestoneEscrowAbi, functionName: "createProject", args: [metadata.freelancer, BigInt(metadata.deadline), data.project.metadataHash, metadata.milestones.map((m) => BigInt(m.amount)), metadata.milestones.map((m) => BigInt(m.dueDate))] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The createProject transaction reverted");
      const event = parseEventLogs({ abi: milestoneEscrowAbi, logs: receipt.logs, eventName: "ProjectCreated" })[0];
      if (!event) throw new Error("ProjectCreated event was not found");
      await apiRequest(`/api/projects/${id}/onchain`, { method: "PATCH", body: JSON.stringify({ transactionHash: hash, onchainProjectId: event.args.projectId.toString() }) });
      setStatus("Draft linked and verified."); await detail.refetch();
    } catch (cause) { setStatus(undefined); setError(cause instanceof Error ? cause.message : "Draft recovery failed"); }
  }
  async function deleteProjectDraft() {
    if (!window.confirm("Delete this unlinked private draft?")) return;
    try { await apiRequest(`/api/projects/${id}`, { method: "DELETE", body: "{}" }); router.push("/dashboard/"); } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft deletion failed"); }
  }
  async function resumeSubmission(submission: ProjectDetail["submissions"][number]) {
    if (!publicClient || !contractAddresses.escrow || onchainId === undefined) return;
    try { setStatus("Resume submission: confirm in your wallet…"); const hash = await write.writeContractAsync({ address: contractAddresses.escrow, abi: milestoneEscrowAbi, functionName: "submitMilestone", args: [onchainId, BigInt(submission.milestoneId), submission.submissionHash] }); const receipt = await publicClient.waitForTransactionReceipt({ hash }); if (receipt.status !== "success") throw new Error("Submission transaction reverted"); await apiRequest(`/api/submissions/${submission.id}/onchain`, { method: "PATCH", body: JSON.stringify({ transactionHash: hash }) }); setStatus("Submission linked and verified."); await detail.refetch(); await milestoneReads.refetch(); } catch (cause) { setStatus(undefined); setError(cause instanceof Error ? cause.message : "Submission recovery failed"); }
  }
  async function deleteSubmissionDraft(submissionId: string) {
    if (!window.confirm("Delete this unlinked submission and its private files?")) return;
    try { await apiRequest(`/api/submissions/${submissionId}`, { method: "DELETE", body: "{}" }); await detail.refetch(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Submission deletion failed"); }
  }

  return <div className="project-layout"><div>
    <section className="panel"><div className="row-between"><span className={`badge ${data.project.linkStatus === "draft" ? "warning" : ""}`}>{chainReady ? PROJECT_STATUS[project.status] : data.project.linkStatus}</span><button className="button small-button ghost" onClick={() => void Promise.all([detail.refetch(), chainProjectRead.refetch(), milestoneReads.refetch()])}><RefreshCw size={14} /> Refresh chain</button></div><h2>{data.project.title}</h2><p className="muted">{data.project.description}</p>{data.project.category && <span className="badge">{data.project.category}</span>}</section>
    <section className="panel"><div className="row-between"><h2>Milestones</h2>{chainReady && <span className="mono muted small">{formatUnits(project.releasedAmount, 6)} / {formatUnits(project.totalAmount, 6)} mUSDC released</span>}</div><div className="milestone-list">{data.milestones.map((milestone, index) => { const live = chainMilestones[index]; return <article className="milestone-item" key={milestone.id}><div className="row-between"><div><h3>{index + 1}. {milestone.title}</h3><p className="muted small">{milestone.description || "No private description"}</p></div><span className="badge">{live ? MILESTONE_STATUS[live.status] : "Draft"}</span></div><div className="project-meta"><span>{formatUnits(BigInt(milestone.amount), 6)} mUSDC</span><span>Due {new Date(milestone.dueDate * 1000).toLocaleString()}</span></div>{chainReady && isClient && project.status === 2 && live?.status === 1 && <button className="button primary small-button" onClick={() => void confirm("Approve milestone", () => write.writeContractAsync({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "approveMilestone", args: [onchainId, BigInt(index)] }))}>Approve & release exact amount</button>}{chainReady && isFreelancer && project.status === 2 && live?.status !== 2 && <SubmissionForm projectId={id} onchainProjectId={onchainId} milestoneId={index} onDone={async () => { await queryClient.invalidateQueries({ queryKey: ["project", id] }); await milestoneReads.refetch(); }} />}</article>; })}</div></section>
    {data.submissions.length > 0 && <section className="panel"><h2>Private evidence</h2><div className="detail-list">{data.submissions.map((submission) => <article key={submission.id}><div className="row-between"><strong>Milestone {submission.milestoneId + 1}</strong><span className={`badge ${submission.linkStatus === "draft" ? "warning" : ""}`}>{submission.linkStatus}</span></div><p className="muted small">{submission.message}</p><div className="action-stack">{data.files.filter((file) => file.submissionId === submission.id).map((file) => <a className="button ghost small-button" href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" key={file.id}>{file.fileName} · {(file.fileSize / 1024 / 1024).toFixed(2)} MB</a>)}{submission.linkStatus === "draft" && isFreelancer && <><button className="button primary small-button" onClick={() => void resumeSubmission(submission)}>Resume on-chain submission</button><button className="button danger small-button" onClick={() => void deleteSubmissionDraft(submission.id)}>Delete draft & files</button></>}</div></article>)}</div></section>}
  </div><aside className="sidebar"><section className="panel"><h2>On-chain facts</h2><dl className="detail-list"><div className="detail-row"><dt>Role</dt><dd>{isClient ? "Client" : isFreelancer ? "Freelancer" : "—"}</dd></div><div className="detail-row"><dt>Escrow</dt><dd>{compactAddress(data.project.contractAddress, 7)}</dd></div><div className="detail-row"><dt>Project ID</dt><dd>{data.project.onchainProjectId ?? "Unlinked draft"}</dd></div><div className="detail-row"><dt>Metadata hash</dt><dd>{compactAddress(data.project.metadataHash, 9)}</dd></div>{chainReady && <><div className="detail-row"><dt>Total</dt><dd>{formatUnits(project.totalAmount, 6)} mUSDC</dd></div><div className="detail-row"><dt>Deadline</dt><dd>{new Date(Number(project.deadline) * 1000).toLocaleString()}</dd></div></>}</dl>{data.project.creationTxHash && <a className="button ghost" href={explorerTx(data.project.creationTxHash)} target="_blank" rel="noreferrer">Creation transaction <ExternalLink size={14} /></a>}
      {!chainReady && data.project.linkStatus === "draft" && isClient && <div className="action-stack"><button className="button primary" onClick={() => void resumeProjectDraft()}>Resume on-chain creation</button><button className="button danger" onClick={() => void deleteProjectDraft()}>Delete private draft</button></div>}
      {chainReady && isClient && project.status === 0 && <div className="action-stack"><button className="button" disabled={allowance.data === project.totalAmount} onClick={() => void confirm("Exact token approval", () => write.writeContractAsync({ address: contractAddresses.mockUsdc!, abi: mockUsdcAbi, functionName: "approve", args: [contractAddresses.escrow!, project.totalAmount] }))}>{allowance.data === project.totalAmount ? "Exact approval ready" : `Approve ${formatUnits(project.totalAmount, 6)} mUSDC`}</button><button className="button primary" disabled={allowance.data !== project.totalAmount} onClick={() => void confirm("Fund escrow", () => write.writeContractAsync({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "fundProject", args: [onchainId] }))}>Fund project</button><button className="button danger" onClick={() => void confirm("Cancel project", () => write.writeContractAsync({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "cancelProject", args: [onchainId] }))}>Cancel unfunded project</button></div>}
      {chainReady && isFreelancer && project.status === 1 && <button className="button primary" onClick={() => void confirm("Accept project", () => write.writeContractAsync({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "acceptProject", args: [onchainId] }))}>Accept project</button>}
      {chainReady && isClient && project.status === 1 && <button className="button danger" onClick={() => void confirm("Refund project", () => write.writeContractAsync({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "refundUnacceptedProject", args: [onchainId] }))}>Refund after 3-day window</button>}
      {status && <div className="status-line" role="status" aria-live="polite">{status}</div>}{error && <div className="status-line error-line" role="alert">{error}</div>}
      <div className="warning-box">Accepted-project funds have no arbitration or automatic release. Funds may remain locked if the client stops responding.</div>{!contractsConfigured && <div className="status-line error-line">Contract addresses are not configured.</div>}</section></aside></div>;
}

function SubmissionForm({ projectId, onchainProjectId, milestoneId, onDone }: { projectId: string; onchainProjectId: bigint; milestoneId: number; onDone: () => Promise<void> }) {
  const publicClient = usePublicClient(); const write = useWriteContract(); const [status, setStatus] = useState<string>(); const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(undefined); const form = new FormData(event.currentTarget); form.set("milestoneId", String(milestoneId)); try { setStatus("Uploading private evidence…"); const draft = await apiRequest<{ id: string; submissionHash: Hash }>(`/api/projects/${projectId}/submissions`, { method: "POST", body: form }); setStatus("Evidence saved. Confirm submission in your wallet…"); const hash = await write.writeContractAsync({ address: contractAddresses.escrow!, abi: milestoneEscrowAbi, functionName: "submitMilestone", args: [onchainProjectId, BigInt(milestoneId), draft.submissionHash] }); setStatus("Waiting for transaction confirmation…"); const receipt = await publicClient!.waitForTransactionReceipt({ hash }); if (receipt.status !== "success") throw new Error("Submission transaction reverted"); setStatus("Verifying receipt and canonical submission hash…"); await apiRequest(`/api/submissions/${draft.id}/onchain`, { method: "PATCH", body: JSON.stringify({ transactionHash: hash }) }); setStatus("Evidence linked to the on-chain milestone."); await onDone(); } catch (cause) { setStatus(undefined); setError(cause instanceof Error ? cause.message : "Submission failed"); } }
  return <form className="action-stack" onSubmit={submit}><div className="field"><label>Submission message</label><textarea name="message" required maxLength={5000} /></div><div className="field"><label><FileUp size={15} /> Evidence files (1–3, 10 MB each)</label><input className="file-input" type="file" name="files" multiple required accept=".png,.jpg,.jpeg,.webp,.pdf,.zip" /></div><button className="button primary" type="submit">Upload & submit on-chain</button>{status && <div className="status-line" role="status">{status}</div>}{error && <div className="status-line error-line" role="alert">{error}</div>}</form>;
}
