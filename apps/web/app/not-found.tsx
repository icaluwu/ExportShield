import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function NotFound() {
  return <PageShell eyebrow="404" title="That page is not in the ledger." intro="The route may have moved, or the private project is unavailable to this wallet."><Link className="button primary" href="/">Return home</Link></PageShell>;
}
