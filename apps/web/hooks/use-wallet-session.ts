"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";
import { apiRequest, ApiClientError } from "@/lib/api";

type WalletSession = {
  address: `0x${string}`;
  chainId: number;
  expiresAt: number;
};

type NonceResponse = {
  nonce: string;
  expiresAt: number;
  domain: string;
  uri: string;
  chainId: number;
};

export function useWalletSession() {
  const account = useAccount();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["wallet-session", account.address],
    enabled: account.isConnected,
    retry: false,
    queryFn: async () => {
      try {
        return await apiRequest<WalletSession>("/api/auth/session");
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) return null;
        throw error;
      }
    },
  });

  const signIn = useCallback(async () => {
    if (!account.address || !account.chainId) throw new Error("Connect a wallet first");
    const nonce = await apiRequest<NonceResponse>("/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ address: account.address, chainId: account.chainId }),
    });
    const message = createSiweMessage({
      address: account.address,
      chainId: nonce.chainId,
      domain: nonce.domain,
      uri: nonce.uri,
      version: "1",
      nonce: nonce.nonce,
      issuedAt: new Date(),
      expirationTime: new Date(nonce.expiresAt * 1000),
      statement: "Sign in to access your private ExportShield project metadata and evidence.",
    });
    const signature = await signMessageAsync({ message });
    const nextSession = await apiRequest<WalletSession>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ message, signature }),
    });
    queryClient.setQueryData(["wallet-session", account.address], nextSession);
    return nextSession;
  }, [account.address, account.chainId, queryClient, signMessageAsync]);

  const signOut = useCallback(async () => {
    await apiRequest<{ signedOut: boolean }>("/api/auth/logout", { method: "POST", body: "{}" });
    queryClient.setQueryData(["wallet-session", account.address], null);
  }, [account.address, queryClient]);

  return {
    ...session,
    session: session.data ?? null,
    signIn,
    signOut,
    isSignedIn:
      Boolean(session.data && account.address) &&
      session.data?.address.toLowerCase() === account.address?.toLowerCase(),
  };
}
