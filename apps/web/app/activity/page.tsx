import { PageShell } from "@/components/page-shell";
import { ProjectList } from "@/components/project-list";
import { WalletGate } from "@/components/wallet-gate";

export default function ActivityPage() {
  return <PageShell eyebrow="Verified trail" title="Activity" intro="Linked creation transactions and local drafts associated with your signed-in wallet."><WalletGate><ProjectList showActivity /></WalletGate></PageShell>;
}
