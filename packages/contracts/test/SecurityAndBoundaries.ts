import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits, zeroAddress, zeroHash } from "viem";

describe("MilestoneEscrow security and boundaries", async () => {
  const connection = await network.create();
  const { viem } = connection;
  const [client, freelancer, outsider] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();
  let token: Awaited<ReturnType<typeof viem.deployContract<"MockUSDC">>>;
  let escrow: Awaited<ReturnType<typeof viem.deployContract<"MilestoneEscrow">>>;
  let now: bigint;

  beforeEach(async () => {
    token = await viem.deployContract("MockUSDC");
    escrow = await viem.deployContract("MilestoneEscrow", [token.address, 3600n]);
    now = (await publicClient.getBlock()).timestamp;
  });

  const createArgs = () => [freelancer.account.address, now + 7200n, `0x${"11".repeat(32)}`, [100n, 200n], [now + 3600n, now + 5400n]] as const;

  it("enforces faucet decimals and cooldown", async () => {
    assert.equal(await token.read.decimals(), 6);
    await token.write.faucet({ account: client.account });
    await viem.assertions.revertWithCustomError(token.write.faucet({ account: client.account }), token, "FaucetCooldownActive");
    await testClient.increaseTime({ seconds: 3600 });
    await testClient.mine({ blocks: 1 });
    await token.write.faucet({ account: client.account });
    assert.equal(await token.read.balanceOf([client.account.address]), parseUnits("20000", 6));
  });

  it("validates constructor, addresses, deadlines, amounts, and array bounds", async () => {
    await assert.rejects(viem.deployContract("MilestoneEscrow", [zeroAddress, 1n]));
    await assert.rejects(viem.deployContract("MilestoneEscrow", [client.account.address, 1n]));
    await assert.rejects(viem.deployContract("MilestoneEscrow", [token.address, 0n]));
    await viem.assertions.revertWithCustomError(escrow.write.createProject([zeroAddress, now + 2n, `0x${"11".repeat(32)}`, [1n], [now + 1n]], { account: client.account }), escrow, "ZeroAddress");
    await viem.assertions.revertWithCustomError(escrow.write.createProject([freelancer.account.address, now, `0x${"11".repeat(32)}`, [1n], [now]], { account: client.account }), escrow, "InvalidDeadline");
    await viem.assertions.revertWithCustomError(escrow.write.createProject([freelancer.account.address, now + 2n, `0x${"11".repeat(32)}`, [0n], [now + 1n]], { account: client.account }), escrow, "InvalidMilestoneAmount");
    await viem.assertions.revertWithCustomError(escrow.write.createProject([freelancer.account.address, now + 2n, `0x${"11".repeat(32)}`, [1n], [now]], { account: client.account }), escrow, "InvalidMilestoneDeadline");
    await viem.assertions.revertWithCustomError(escrow.write.createProject([freelancer.account.address, now + 2n, `0x${"11".repeat(32)}`, [1n, 2n], [now + 1n]], { account: client.account }), escrow, "InvalidMilestoneCount");
    await viem.assertions.revertWithCustomError(escrow.write.createProject([freelancer.account.address, now + 20n, `0x${"11".repeat(32)}`, Array(11).fill(1n), Array(11).fill(now + 1n)], { account: client.account }), escrow, "InvalidMilestoneCount");
  });

  it("covers cancellation, missing records, invalid states, and all participant guards", async () => {
    await viem.assertions.revertWithCustomError(escrow.read.getProject([99n]), escrow, "ProjectNotFound");
    await escrow.write.createProject(createArgs(), { account: client.account });
    await viem.assertions.revertWithCustomError(escrow.read.getMilestone([0n, 2n]), escrow, "MilestoneNotFound");
    await viem.assertions.revertWithCustomError(escrow.write.cancelProject([0n], { account: outsider.account }), escrow, "Unauthorized");
    await escrow.write.cancelProject([0n], { account: client.account });
    assert.equal((await escrow.read.getProject([0n])).status, 4);
    await viem.assertions.revertWithCustomError(escrow.write.cancelProject([0n], { account: client.account }), escrow, "InvalidProjectStatus");
  });

  it("rejects invalid submission and approval paths, including a paid milestone resubmission", async () => {
    await escrow.write.createProject(createArgs(), { account: client.account });
    await token.write.faucet({ account: client.account });
    await token.write.approve([escrow.address, 300n], { account: client.account });
    await escrow.write.fundProject([0n], { account: client.account });
    await viem.assertions.revertWithCustomError(escrow.write.refundUnacceptedProject([0n], { account: outsider.account }), escrow, "Unauthorized");
    await escrow.write.acceptProject([0n], { account: freelancer.account });
    await viem.assertions.revertWithCustomError(escrow.write.submitMilestone([0n, 0n, zeroHash], { account: freelancer.account }), escrow, "InvalidSubmissionHash");
    await viem.assertions.revertWithCustomError(escrow.write.submitMilestone([0n, 0n, `0x${"22".repeat(32)}`], { account: outsider.account }), escrow, "Unauthorized");
    await viem.assertions.revertWithCustomError(escrow.write.approveMilestone([0n, 0n], { account: client.account }), escrow, "InvalidMilestoneStatus");
    await escrow.write.submitMilestone([0n, 0n, `0x${"22".repeat(32)}`], { account: freelancer.account });
    await viem.assertions.revertWithCustomError(escrow.write.approveMilestone([0n, 0n], { account: outsider.account }), escrow, "Unauthorized");
    await escrow.write.approveMilestone([0n, 0n], { account: client.account });
    assert.equal((await escrow.read.getProject([0n])).status, 2);
    await viem.assertions.revertWithCustomError(escrow.write.submitMilestone([0n, 0n, `0x${"33".repeat(32)}`], { account: freelancer.account }), escrow, "InvalidMilestoneStatus");
    await escrow.write.submitMilestone([0n, 1n, `0x${"44".repeat(32)}`], { account: freelancer.account });
    await escrow.write.approveMilestone([0n, 1n], { account: client.account });
    assert.equal((await escrow.read.getProject([0n])).releasedAmount, 300n);
  });

  it("rejects fee-on-transfer funding and blocks token callback reentrancy", async () => {
    const feeToken = await viem.deployContract("FeeOnTransferToken");
    const feeEscrow = await viem.deployContract("MilestoneEscrow", [feeToken.address, 3600n]);
    await feeEscrow.write.createProject(createArgs(), { account: client.account });
    await feeToken.write.approve([feeEscrow.address, 300n], { account: client.account });
    await viem.assertions.revertWithCustomError(feeEscrow.write.fundProject([0n], { account: client.account }), feeEscrow, "UnsupportedPaymentToken");

    const reentrantToken = await viem.deployContract("ReentrantPaymentToken");
    const guardedEscrow = await viem.deployContract("MilestoneEscrow", [reentrantToken.address, 3600n]);
    await reentrantToken.write.setTarget([guardedEscrow.address], { account: client.account });
    await guardedEscrow.write.createProject(createArgs(), { account: client.account });
    await reentrantToken.write.approve([guardedEscrow.address, 300n], { account: client.account });
    await guardedEscrow.write.fundProject([0n], { account: client.account });
    assert.equal(await reentrantToken.read.reentryBlocked(), true);
    assert.equal((await guardedEscrow.read.getProject([0n])).status, 1);
  });
});
