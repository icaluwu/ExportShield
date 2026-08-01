import { PageShell } from "@/components/page-shell";

export default function TermsPage() {
  return (
    <PageShell eyebrow="Important limitations" title="Testnet demonstration terms" intro="ExportShield is an experimental hackathon MVP. It is not a production escrow service, financial advice, or a substitute for a legal agreement.">
      <div className="panel detail-list">
        <section><h2>No arbitration or automatic release</h2><p className="muted">After a freelancer accepts a funded project, only the client can approve milestones. There is no arbiter, active-project refund, dispute resolution, or automatic release. Funds may remain locked indefinitely if the client stops responding.</p></section>
        <section><h2>Testnet assets have no value</h2><p className="muted">MockUSDC and Monad Testnet tokens are demonstration assets and must not be bought, sold, or represented as real funds.</p></section>
        <section><h2>Use at your own risk</h2><p className="muted">The contracts and application have not been professionally audited. Do not deploy this MVP to mainnet or use it for assets with economic value.</p></section>
        <section><h2>Participant privacy</h2><p className="muted">Metadata and uploaded evidence are intended to be readable only by the project client and freelancer. On-chain addresses, values, hashes, and transactions remain public.</p></section>
      </div>
    </PageShell>
  );
}
