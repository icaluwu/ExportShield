import Link from "next/link";
import { ArrowRight, FileLock2, Landmark, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Built for cross-border work</p>
          <h1>Ship the work.<br /><span>Protect the payment.</span></h1>
          <p className="hero-copy">
            ExportShield locks testnet mUSDC in a milestone escrow. Private project details stay at the edge while the payment truth stays on-chain.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/create/">Create an escrow <ArrowRight size={17} /></Link>
            <Link className="button ghost" href="/dashboard/">Open dashboard</Link>
          </div>
        </div>
        <div className="hero-visual" aria-label="Example milestone escrow">
          <div className="hero-grid" />
          <div className="escrow-card">
            <div className="escrow-card-head"><span className="badge">Active escrow</span><ShieldCheck size={20} /></div>
            <h3>Export compliance review</h3>
            <p className="muted small">2 of 3 milestones released</p>
            <div className="amount">6,500.00 <span className="muted small">mUSDC</span></div>
            <div className="progress"><span /></div>
          </div>
          <div className="floating-status">✓ PAYMENT VERIFIED ON-CHAIN</div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <h2>One agreement. Two participants. Verifiable progress.</h2>
          <p>Draft privately, fund exactly, submit evidence, and release each milestone only after client approval.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card"><span className="feature-number">01</span><h3><Landmark size={20} /> On-chain funds</h3><p>MockUSDC remains in a non-upgradeable escrow until the client approves a submitted milestone.</p></article>
          <article className="feature-card"><span className="feature-number">02</span><h3><FileLock2 size={20} /> Private evidence</h3><p>Project metadata and files are available only to the authenticated client and freelancer.</p></article>
          <article className="feature-card"><span className="feature-number">03</span><h3><ShieldCheck size={20} /> Receipt-linked records</h3><p>Every off-chain draft is linked only after its signer, contract, event, and canonical hash are verified.</p></article>
        </div>
      </section>
    </main>
  );
}
