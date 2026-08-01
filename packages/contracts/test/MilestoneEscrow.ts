import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, parseUnits, zeroHash } from "viem";

describe("MilestoneEscrow", async () => {
  const connection = await network.create();
  const { viem } = connection;
  const [client, freelancer, outsider] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const testClient = await viem.getTestClient();

  let token: Awaited<ReturnType<typeof viem.deployContract<"MockUSDC">>>;
  let escrow: Awaited<ReturnType<typeof viem.deployContract<"MilestoneEscrow">>>;
  let deadline: bigint;
  let dueDate: bigint;

  beforeEach(async () => {
    token = await viem.deployContract("MockUSDC");
    escrow = await viem.deployContract("MilestoneEscrow", [token.address, 3n * 24n * 60n * 60n]);
    const block = await publicClient.getBlock();
    dueDate = block.timestamp + 24n * 60n * 60n;
    deadline = block.timestamp + 7n * 24n * 60n * 60n;
  });

  async function createProject(amount = parseUnits("250", 6)) {
    await escrow.write.createProject(
      [freelancer.account.address, deadline, `0x${"11".repeat(32)}`, [amount], [dueDate]],
      { account: client.account },
    );
    return amount;
  }

  async function fundAndAccept(amount: bigint) {
    await token.write.faucet({ account: client.account });
    await token.write.approve([escrow.address, amount], { account: client.account });
    await escrow.write.fundProject([0n], { account: client.account });
    await escrow.write.acceptProject([0n], { account: freelancer.account });
  }

  it("creates, funds, accepts, submits, and pays a project", async () => {
    const amount = await createProject();
    await fundAndAccept(amount);

    const submissionHash = `0x${"22".repeat(32)}` as const;
    await escrow.write.submitMilestone([0n, 0n, submissionHash], {
      account: freelancer.account,
    });
    await escrow.write.approveMilestone([0n, 0n], { account: client.account });

    const project = await escrow.read.getProject([0n]);
    const milestone = await escrow.read.getMilestone([0n, 0n]);
    assert.equal(project.status, 3);
    assert.equal(project.releasedAmount, amount);
    assert.equal(milestone.status, 2);
    assert.equal(milestone.submissionHash, submissionHash);
    assert.equal(await token.read.balanceOf([freelancer.account.address]), amount);
  });

  it("allows resubmission but prevents a second payment", async () => {
    const amount = await createProject();
    await fundAndAccept(amount);

    await escrow.write.submitMilestone([0n, 0n, `0x${"22".repeat(32)}`], {
      account: freelancer.account,
    });
    await escrow.write.submitMilestone([0n, 0n, `0x${"33".repeat(32)}`], {
      account: freelancer.account,
    });
    await escrow.write.approveMilestone([0n, 0n], { account: client.account });

    await viem.assertions.revertWithCustomError(
      escrow.write.approveMilestone([0n, 0n], { account: client.account }),
      escrow,
      "InvalidProjectStatus",
    );
  });

  it("restricts lifecycle actions to the assigned roles", async () => {
    const amount = await createProject();
    await token.write.faucet({ account: client.account });
    await token.write.approve([escrow.address, amount], { account: client.account });

    await viem.assertions.revertWithCustomError(
      escrow.write.fundProject([0n], { account: outsider.account }),
      escrow,
      "Unauthorized",
    );
    await escrow.write.fundProject([0n], { account: client.account });
    await viem.assertions.revertWithCustomError(
      escrow.write.acceptProject([0n], { account: outsider.account }),
      escrow,
      "Unauthorized",
    );
  });

  it("refunds a funded project only after the acceptance period", async () => {
    const amount = await createProject();
    await token.write.faucet({ account: client.account });
    await token.write.approve([escrow.address, amount], { account: client.account });
    await escrow.write.fundProject([0n], { account: client.account });

    await viem.assertions.revertWithCustomError(
      escrow.write.refundUnacceptedProject([0n], { account: client.account }),
      escrow,
      "AcceptancePeriodActive",
    );
    await testClient.increaseTime({ seconds: 3 * 24 * 60 * 60 });
    await testClient.mine({ blocks: 1 });
    await escrow.write.refundUnacceptedProject([0n], { account: client.account });

    assert.equal((await escrow.read.getProject([0n])).status, 5);
    assert.equal(await token.read.balanceOf([client.account.address]), parseUnits("10000", 6));
  });

  it("rejects invalid project inputs", async () => {
    await viem.assertions.revertWithCustomError(
      escrow.write.createProject(
        [client.account.address, deadline, `0x${"11".repeat(32)}`, [1n], [dueDate]],
        { account: client.account },
      ),
      escrow,
      "SameParticipant",
    );
    await viem.assertions.revertWithCustomError(
      escrow.write.createProject(
        [freelancer.account.address, deadline, zeroHash, [1n], [dueDate]],
        { account: client.account },
      ),
      escrow,
      "InvalidMetadataHash",
    );
    await viem.assertions.revertWithCustomError(
      escrow.write.createProject(
        [freelancer.account.address, deadline, `0x${"11".repeat(32)}`, [], []],
        { account: client.account },
      ),
      escrow,
      "InvalidMilestoneCount",
    );
    await viem.assertions.revertWithCustomError(
      escrow.write.createProject(
        [freelancer.account.address, deadline, `0x${"11".repeat(32)}`, [1n], [deadline + 1n]],
        { account: client.account },
      ),
      escrow,
      "InvalidMilestoneDeadline",
    );
    const maxUint96 = (1n << 96n) - 1n;
    await viem.assertions.revertWithCustomError(
      escrow.write.createProject(
        [
          freelancer.account.address,
          deadline,
          `0x${"11".repeat(32)}`,
          [maxUint96, maxUint96],
          [dueDate, dueDate],
        ],
        { account: client.account },
      ),
      escrow,
      "AmountOverflow",
    );
  });

  it("uses checksummed participant addresses in reads", async () => {
    await createProject();
    const project = await escrow.read.getProject([0n]);
    assert.equal(getAddress(project.client), getAddress(client.account.address));
    assert.equal(getAddress(project.freelancer), getAddress(freelancer.account.address));
  });
});
