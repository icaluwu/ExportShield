"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { Droplets } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { WalletGate } from "@/components/wallet-gate";
import { contractAddresses, contractsConfigured } from "@/lib/app-config";
import { mockUsdcAbi } from "@/lib/contracts";
import { explorerTx } from "@/lib/api";

export default function FaucetPage() {
  const account = useAccount();
  const [error, setError] = useState<string>();
  const write = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: write.data });
  const balance = useReadContract({ address: contractAddresses.mockUsdc ?? undefined, abi: mockUsdcAbi, functionName: "balanceOf", args: account.address ? [account.address] : undefined, query: { enabled: Boolean(account.address && contractAddresses.mockUsdc), refetchInterval: 10_000 } });
  async function claim() { setError(undefined); try { await write.writeContractAsync({ address: contractAddresses.mockUsdc!, abi: mockUsdcAbi, functionName: "faucet" }); } catch (cause) { setError(cause instanceof Error ? cause.message : "The faucet request failed"); } }
  return <PageShell eyebrow="Testnet utility" title="Get mock USDC" intro="Each address may mint 10,000 mUSDC once per hour. These tokens have no monetary value."><WalletGate><section className="gate-card"><div className="gate-icon"><Droplets /></div><h2>{balance.data === undefined ? "—" : formatUnits(balance.data, 6)} mUSDC</h2><p>Wallet balance on Monad Testnet</p>{contractsConfigured ? <button className="button primary" disabled={write.isPending || receipt.isLoading} onClick={() => void claim()}>{write.isPending ? "Confirm in wallet…" : receipt.isLoading ? "Waiting for confirmation…" : "Claim 10,000 mUSDC"}</button> : <div className="status-line error-line">Contract addresses have not been configured.</div>}{write.data && <a className="button ghost" href={explorerTx(write.data)} target="_blank" rel="noreferrer">View transaction</a>}{receipt.isSuccess && <div className="status-line" role="status">Faucet transaction confirmed.</div>}{error && <div className="status-line error-line" role="alert">{error}</div>}</section></WalletGate></PageShell>;
}
