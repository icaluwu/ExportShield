import { TriangleAlert } from "lucide-react";

export function TestnetBanner() {
  return (
    <div className="testnet-banner" role="status">
      <TriangleAlert size={15} aria-hidden="true" />
      <span>MONAD TESTNET · Mock assets only · Not a production financial service</span>
    </div>
  );
}
