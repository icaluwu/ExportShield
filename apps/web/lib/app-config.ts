import { getAddress, isAddress, type Address } from "viem";

export const appConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? "ExportShield",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  explorerUrl: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "https://testnet.monadexplorer.com",
  walletConnectProjectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "exportshield-local-development",
};

function optionalAddress(value: string | undefined): Address | null {
  return value && isAddress(value) ? getAddress(value) : null;
}

export const contractAddresses = {
  escrow: optionalAddress(process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS),
  mockUsdc: optionalAddress(process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS),
};

export const contractsConfigured = Boolean(contractAddresses.escrow && contractAddresses.mockUsdc);
