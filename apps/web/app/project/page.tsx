"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ProjectDetailView } from "@/components/project-detail";
import { WalletGate } from "@/components/wallet-gate";

export default function ProjectPage() { return <Suspense fallback={<main className="page-shell"><div className="skeleton-card" /></main>}><ProjectRoute /></Suspense>; }
function ProjectRoute() { const id = useSearchParams().get("id"); return <PageShell eyebrow="Live escrow" title="Project workspace" intro="Private context comes from D1; all payment status and available actions below are refreshed from the contract."><WalletGate>{id ? <ProjectDetailView id={id} /> : <div className="status-line error-line">A project ID is required.</div>}</WalletGate></PageShell>; }
