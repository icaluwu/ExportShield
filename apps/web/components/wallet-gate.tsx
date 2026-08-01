"use client";

import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { AppKitButton } from "@reown/appkit/react";
import { LogIn, Network } from "lucide-react";
import { MONAD_TESTNET_CHAIN_ID } from "@exportshield/shared";
import { useWalletSession } from "@/hooks/use-wallet-session";

export function WalletGate({ children }: { children: ReactNode }) {
  const account = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const session = useWalletSession();

  if (!account.isConnected) {
    return (
      <section className="gate-card">
        <div className="gate-icon"><LogIn /></div>
        <h2>Connect your wallet</h2>
        <p>Your wallet identifies your role in every escrow project.</p>
        <AppKitButton />
      </section>
    );
  }
  if (account.chainId !== MONAD_TESTNET_CHAIN_ID) {
    return (
      <section className="gate-card">
        <div className="gate-icon"><Network /></div>
        <h2>Switch to Monad Testnet</h2>
        <p>ExportShield only accepts transactions on chain ID {MONAD_TESTNET_CHAIN_ID}.</p>
        <button
          className="button primary"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: MONAD_TESTNET_CHAIN_ID })}
        >
          {isSwitching ? "Switching…" : "Switch network"}
        </button>
      </section>
    );
  }
  if (session.isLoading) return <div className="skeleton-card" aria-label="Checking wallet session" />;
  if (!session.isSignedIn) {
    return (
      <section className="gate-card">
        <div className="gate-icon"><ShieldCheckIcon /></div>
        <h2>Sign in securely</h2>
        <p>One SIWE signature unlocks private project metadata for eight hours. This does not send a transaction.</p>
        <button className="button primary" onClick={() => void session.signIn()}>
          Sign in with Ethereum
        </button>
      </section>
    );
  }
  return children;
}

function ShieldCheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Zm-1 12 5-5-1.4-1.4-3.6 3.6-1.6-1.6L8 12l3 3Z" fill="currentColor" /></svg>;
}
