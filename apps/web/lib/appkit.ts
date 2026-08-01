"use client";

import { createAppKit } from "@reown/appkit/react";
import { monadTestnet } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { http } from "wagmi";
import { appConfig } from "./app-config";

const network = {
  ...monadTestnet,
  rpcUrls: {
    ...monadTestnet.rpcUrls,
    default: { http: [appConfig.rpcUrl] },
  },
};

export const wagmiAdapter = new WagmiAdapter({
  networks: [network],
  projectId: appConfig.walletConnectProjectId,
  ssr: true,
  transports: {
    [network.id]: http(appConfig.rpcUrl),
  },
});

type AppKitAdapter = NonNullable<Parameters<typeof createAppKit>[0]["adapters"]>[number];

createAppKit({
  adapters: [wagmiAdapter as unknown as AppKitAdapter],
  networks: [network],
  defaultNetwork: network,
  projectId: appConfig.walletConnectProjectId,
  metadata: {
    name: appConfig.name,
    description: "Milestone escrow for safer project payments",
    url: typeof window === "undefined" ? "https://exportshield.pages.dev" : window.location.origin,
    icons: [],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#8ef0b0",
    "--w3m-border-radius-master": "2px",
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
});
