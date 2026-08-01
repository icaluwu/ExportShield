import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const THREE_DAYS = 3 * 24 * 60 * 60;

export default buildModule("ExportShield", (module) => {
  const mockUsdc = module.contract("MockUSDC");
  const escrow = module.contract("MilestoneEscrow", [mockUsdc, THREE_DAYS]);

  return { mockUsdc, escrow };
});
