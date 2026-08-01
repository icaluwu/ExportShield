"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppKitButton } from "@reown/appkit/react";
import { ShieldCheck } from "lucide-react";
import { clsx } from "clsx";

const links = [
  ["Dashboard", "/dashboard/"],
  ["Create", "/create/"],
  ["Faucet", "/faucet/"],
  ["Activity", "/activity/"],
] as const;

export function Header() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/" aria-label="ExportShield home">
          <span className="brand-mark"><ShieldCheck aria-hidden="true" /></span>
          <span>EXPORT<span>SHIELD</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {links.map(([label, href]) => (
            <Link key={href} className={clsx("nav-link", pathname === href && "active")} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="wallet-slot"><AppKitButton balance="hide" /></div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {links.map(([label, href]) => (
          <Link key={href} className={clsx("nav-link", pathname === href && "active")} href={href}>
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
