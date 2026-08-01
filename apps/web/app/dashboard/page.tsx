import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ProjectList } from "@/components/project-list";
import { WalletGate } from "@/components/wallet-gate";

export default function DashboardPage() {
  return <PageShell eyebrow="Private workspace" title="Your projects" intro="Discovery comes from your authenticated private records. Open a linked project to refresh its financial state directly from the escrow contract."><WalletGate><div className="row-between" style={{ marginBottom: 22 }}><p className="muted">Client and freelancer projects</p><Link className="button primary" href="/create/">New escrow</Link></div><ProjectList /></WalletGate></PageShell>;
}
