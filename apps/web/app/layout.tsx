import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { TestnetBanner } from "@/components/testnet-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ExportShield", template: "%s · ExportShield" },
  description: "Milestone escrow for safer project payments on Monad Testnet.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <TestnetBanner />
          <Header />
          {children}
          <footer className="site-footer">
            <span>ExportShield MVP · Monad Testnet</span>
            <a href="/terms/">Terms & limitations</a>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
