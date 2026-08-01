"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { getAddress, parseEventLogs, parseUnits } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { Plus, Trash2 } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { WalletGate } from "@/components/wallet-gate";
import { apiRequest } from "@/lib/api";
import { contractAddresses, contractsConfigured } from "@/lib/app-config";
import { milestoneEscrowAbi } from "@/lib/contracts";

type FormValues = { title: string; description: string; category: string; freelancer: string; deadline: string; milestones: Array<{ title: string; description: string; amount: string; dueDate: string }> };
const initialValues: FormValues = { title: "", description: "", category: "", freelancer: "", deadline: "", milestones: [{ title: "", description: "", amount: "", dueDate: "" }] };

export default function CreatePage() {
  const router = useRouter();
  const account = useAccount();
  const publicClient = usePublicClient();
  const write = useWriteContract();
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const form = useForm<FormValues>({ defaultValues: initialValues });
  const milestones = useFieldArray({ control: form.control, name: "milestones" });

  useEffect(() => {
    const saved = localStorage.getItem("exportshield:create-draft");
    if (saved) { try { form.reset(JSON.parse(saved) as FormValues); } catch { localStorage.removeItem("exportshield:create-draft"); } }
    // React Hook Form intentionally owns this subscription lifecycle.
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = form.watch((value) => localStorage.setItem("exportshield:create-draft", JSON.stringify(value)));
    return () => subscription.unsubscribe();
  }, [form]);

  async function submit(values: FormValues) {
    setError(undefined);
    if (!account.address || !publicClient || !contractAddresses.escrow) return;
    try {
      const deadline = Math.floor(new Date(values.deadline).getTime() / 1000);
      const normalizedMilestones = values.milestones.map((milestone, index) => ({ index, title: milestone.title, description: milestone.description || null, amount: parseUnits(milestone.amount, 6).toString(), dueDate: Math.floor(new Date(milestone.dueDate).getTime() / 1000) }));
      const payload = { version: 1 as const, client: account.address, freelancer: getAddress(values.freelancer), title: values.title, description: values.description, category: values.category || null, deadline, milestones: normalizedMilestones };
      setStatus("Saving the private project draft…");
      const draft = await apiRequest<{ id: string; metadataHash: `0x${string}` }>("/api/projects", { method: "POST", body: JSON.stringify(payload) });
      setStatus("Draft saved. Confirm createProject in your wallet…");
      const hash = await write.writeContractAsync({ address: contractAddresses.escrow, abi: milestoneEscrowAbi, functionName: "createProject", args: [payload.freelancer, BigInt(deadline), draft.metadataHash, normalizedMilestones.map((m) => BigInt(m.amount)), normalizedMilestones.map((m) => BigInt(m.dueDate))] });
      setStatus("Transaction submitted. Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The createProject transaction reverted");
      const events = parseEventLogs({ abi: milestoneEscrowAbi, logs: receipt.logs, eventName: "ProjectCreated" });
      const projectId = events[0]?.args.projectId;
      if (projectId === undefined) throw new Error("ProjectCreated event was not found in the receipt");
      setStatus("Transaction confirmed. Verifying and linking the receipt…");
      await apiRequest(`/api/projects/${draft.id}/onchain`, { method: "PATCH", body: JSON.stringify({ transactionHash: hash, onchainProjectId: projectId.toString() }) });
      localStorage.removeItem("exportshield:create-draft");
      router.push(`/project/?id=${draft.id}`);
    } catch (cause) { setStatus(undefined); setError(cause instanceof Error ? cause.message : "Project creation failed"); }
  }

  return <PageShell eyebrow="New agreement" title="Create a milestone escrow" intro="Your private draft is saved before any wallet transaction. Amounts are entered in mUSDC and converted to six-decimal base units."><WalletGate><form onSubmit={form.handleSubmit(submit)}>
    <section className="panel"><div className="form-grid">
      <div className="field full"><label htmlFor="title">Project title</label><input id="title" {...form.register("title", { required: true, maxLength: 160 })} /></div>
      <div className="field full"><label htmlFor="description">Private description</label><textarea id="description" {...form.register("description", { required: true })} /></div>
      <div className="field"><label htmlFor="category">Category</label><input id="category" {...form.register("category")} placeholder="Compliance, design, logistics…" /></div>
      <div className="field"><label htmlFor="freelancer">Freelancer wallet</label><input id="freelancer" className="mono" {...form.register("freelancer", { required: true, pattern: /^0x[a-fA-F0-9]{40}$/ })} placeholder="0x…" /></div>
      <div className="field"><label htmlFor="deadline">Project deadline</label><input id="deadline" type="datetime-local" {...form.register("deadline", { required: true })} /></div>
    </div></section>
    <section className="panel"><div className="row-between"><div><p className="eyebrow">Payment schedule</p><h2>Milestones</h2></div><button className="button small-button" type="button" disabled={milestones.fields.length >= 10} onClick={() => milestones.append({ title: "", description: "", amount: "", dueDate: "" })}><Plus size={15} /> Add</button></div>
      {milestones.fields.map((item, index) => <div className="milestone-card" key={item.id}><div className="milestone-head"><strong>Milestone {index + 1}</strong>{milestones.fields.length > 1 && <button className="button small-button ghost" type="button" aria-label={`Remove milestone ${index + 1}`} onClick={() => milestones.remove(index)}><Trash2 size={15} /></button>}</div><div className="form-grid"><div className="field full"><label>Title</label><input {...form.register(`milestones.${index}.title`, { required: true })} /></div><div className="field full"><label>Description</label><textarea {...form.register(`milestones.${index}.description`)} /></div><div className="field"><label>Amount (mUSDC)</label><input inputMode="decimal" {...form.register(`milestones.${index}.amount`, { required: true, validate: (value) => Number(value) > 0 })} placeholder="1000.00" /></div><div className="field"><label>Deadline</label><input type="datetime-local" {...form.register(`milestones.${index}.dueDate`, { required: true })} /></div></div></div>)}
      {!contractsConfigured && <div className="status-line error-line">Contract addresses are not configured. You may fill the form, but cannot submit it.</div>}
      {status && <div className="status-line" role="status" aria-live="polite">{status}</div>}{error && <div className="status-line error-line" role="alert">{error}</div>}
      <div className="form-actions"><button className="button primary" disabled={!contractsConfigured || form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? "Creating…" : "Save draft & create on-chain"}</button></div>
    </section>
  </form></WalletGate></PageShell>;
}
