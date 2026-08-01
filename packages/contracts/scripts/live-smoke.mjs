import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  parseAbi,
  parseEventLogs,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

if (process.env.LIVE_SMOKE_CONFIRM !== "YES") {
  throw new Error("Set LIVE_SMOKE_CONFIRM=YES to run the state-changing Monad Testnet smoke test");
}

const rpcUrl = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const origin = process.env.EXPORTSHIELD_ORIGIN ?? "https://exportshield.pages.dev";
const escrow = getAddress(process.env.ESCROW_CONTRACT_ADDRESS);
const mockUsdc = getAddress(process.env.MOCK_USDC_ADDRESS);

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});

function accountFromEnvironment(name) {
  const value = process.env[name];
  if (!/^0x[0-9a-fA-F]{64}$/.test(value ?? "")) {
    throw new Error(`${name} is missing or invalid`);
  }
  return privateKeyToAccount(value);
}

const deployer = accountFromEnvironment("DEPLOYER_PRIVATE_KEY");
const client = accountFromEnvironment("CLIENT_PRIVATE_KEY");
const freelancer = accountFromEnvironment("FREELANCER_PRIVATE_KEY");
const outsider = accountFromEnvironment("OUTSIDER_PRIVATE_KEY");
const publicClient = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) });

function wallet(account) {
  return createWalletClient({ account, chain: monadTestnet, transport: http(rpcUrl) });
}

const wallets = {
  deployer: wallet(deployer),
  client: wallet(client),
  freelancer: wallet(freelancer),
  outsider: wallet(outsider),
};

const escrowAbi = parseAbi([
  "function createProject(address freelancer,uint64 deadline,bytes32 metadataHash,uint96[] milestoneAmounts,uint64[] milestoneDeadlines) returns (uint256)",
  "function fundProject(uint256 projectId)",
  "function acceptProject(uint256 projectId)",
  "function submitMilestone(uint256 projectId,uint256 milestoneId,bytes32 submissionHash)",
  "function approveMilestone(uint256 projectId,uint256 milestoneId)",
  "function getProject(uint256 projectId) view returns ((address client,address freelancer,uint96 totalAmount,uint96 releasedAmount,uint64 createdAt,uint64 fundedAt,uint64 deadline,uint32 milestoneCount,uint8 status,bytes32 metadataHash))",
  "function getMilestone(uint256 projectId,uint256 milestoneId) view returns ((uint96 amount,uint64 dueDate,uint8 status,bytes32 submissionHash))",
  "event ProjectCreated(uint256 indexed projectId,address indexed client,address indexed freelancer,uint256 totalAmount,bytes32 metadataHash)",
]);

const tokenAbi = parseAbi([
  "function faucet()",
  "function approve(address spender,uint256 value) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
]);

async function waitFor(hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
  return receipt;
}

async function writeContract(sender, request) {
  return waitFor(await sender.writeContract(request));
}

async function ensureGas(account, target = parseEther("0.08")) {
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance >= target) return null;
  const hash = await wallets.deployer.sendTransaction({
    to: account.address,
    value: target - balance,
    // Monad charges state access dynamically; first funding of a fresh account can exceed EVM's 21k baseline.
    gas: 500_000n,
  });
  await waitFor(hash);
  return hash;
}

async function request(path, { cookie, json, body, ...init } = {}) {
  const headers = new Headers(init.headers);
  headers.set("origin", origin);
  if (cookie) headers.set("cookie", cookie);
  if (json !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(`${origin}${path}`, {
    ...init,
    headers,
    body: json === undefined ? body : JSON.stringify(json),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  return { response, payload };
}

async function requestData(path, options) {
  const result = await request(path, options);
  if (!result.response.ok) {
    throw new Error(`${options?.method ?? "GET"} ${path} failed: ${result.response.status} ${JSON.stringify(result.payload)}`);
  }
  return result.payload.data;
}

async function signIn(account) {
  const nonce = await requestData("/api/auth/nonce", {
    method: "POST",
    json: { address: account.address, chainId: 10143 },
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
  const signature = await account.signMessage({ message });
  const verified = await request("/api/auth/verify", {
    method: "POST",
    json: { message, signature },
  });
  if (!verified.response.ok) {
    throw new Error(`SIWE verify failed: ${verified.response.status} ${JSON.stringify(verified.payload)}`);
  }
  const cookie = verified.response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("SIWE session cookie was not returned");
  return cookie;
}

const fundingTransactions = {};
fundingTransactions.client = await ensureGas(client);
fundingTransactions.freelancer = await ensureGas(freelancer);
fundingTransactions.outsider = await ensureGas(outsider);

const [clientCookie, freelancerCookie, outsiderCookie] = await Promise.all([
  signIn(client),
  signIn(freelancer),
  signIn(outsider),
]);

const now = Math.floor(Date.now() / 1000);
const milestoneDeadline = now + 24 * 60 * 60;
const projectDeadline = now + 2 * 24 * 60 * 60;
const milestoneAmount = 2_500_000n;
const metadata = {
  version: 1,
  client: client.address,
  freelancer: freelancer.address,
  title: `Monad live smoke ${new Date().toISOString()}`,
  description: "Live two-wallet acceptance test for ExportShield.",
  category: "Hackathon verification",
  deadline: projectDeadline,
  milestones: [
    {
      index: 0,
      title: "Deliver verified evidence",
      description: "One private PDF proving the live workflow.",
      amount: milestoneAmount.toString(),
      dueDate: milestoneDeadline,
    },
  ],
};

const draft = await requestData("/api/projects", {
  method: "POST",
  cookie: clientCookie,
  json: metadata,
});

const createReceipt = await writeContract(wallets.client, {
  address: escrow,
  abi: escrowAbi,
  functionName: "createProject",
  args: [
    freelancer.address,
    BigInt(projectDeadline),
    draft.metadataHash,
    [milestoneAmount],
    [BigInt(milestoneDeadline)],
  ],
});
const projectEvent = parseEventLogs({
  abi: escrowAbi,
  logs: createReceipt.logs,
  eventName: "ProjectCreated",
})[0];
if (!projectEvent) throw new Error("ProjectCreated event missing from live receipt");
const projectId = projectEvent.args.projectId;

await requestData(`/api/projects/${draft.id}/onchain`, {
  method: "PATCH",
  cookie: clientCookie,
  json: { transactionHash: createReceipt.transactionHash, onchainProjectId: projectId.toString() },
});

const outsiderProjectRead = await request(`/api/projects/${draft.id}`, { cookie: outsiderCookie });
if (outsiderProjectRead.response.status !== 403) {
  throw new Error(`Outsider project access returned ${outsiderProjectRead.response.status}, expected 403`);
}

const faucetReceipt = await writeContract(wallets.client, {
  address: mockUsdc,
  abi: tokenAbi,
  functionName: "faucet",
});
const approvalReceipt = await writeContract(wallets.client, {
  address: mockUsdc,
  abi: tokenAbi,
  functionName: "approve",
  args: [escrow, milestoneAmount],
});
const exactAllowance = await publicClient.readContract({
  address: mockUsdc,
  abi: tokenAbi,
  functionName: "allowance",
  args: [client.address, escrow],
});
if (exactAllowance !== milestoneAmount) throw new Error("Exact ERC-20 allowance was not recorded");

const fundReceipt = await writeContract(wallets.client, {
  address: escrow,
  abi: escrowAbi,
  functionName: "fundProject",
  args: [projectId],
});
const acceptReceipt = await writeContract(wallets.freelancer, {
  address: escrow,
  abi: escrowAbi,
  functionName: "acceptProject",
  args: [projectId],
});

const evidenceBytes = new TextEncoder().encode("%PDF-1.7\nExportShield private live evidence\n%%EOF\n");
const form = new FormData();
form.set("milestoneId", "0");
form.set("message", "Live evidence uploaded by the assigned freelancer.");
form.append("files", new File([evidenceBytes], "live-evidence.pdf", { type: "application/pdf" }));
const submissionDraft = await requestData(`/api/projects/${draft.id}/submissions`, {
  method: "POST",
  cookie: freelancerCookie,
  body: form,
});

const submitReceipt = await writeContract(wallets.freelancer, {
  address: escrow,
  abi: escrowAbi,
  functionName: "submitMilestone",
  args: [projectId, 0n, submissionDraft.submissionHash],
});
await requestData(`/api/submissions/${submissionDraft.id}/onchain`, {
  method: "PATCH",
  cookie: freelancerCookie,
  json: { transactionHash: submitReceipt.transactionHash },
});

const detail = await requestData(`/api/projects/${draft.id}`, { cookie: clientCookie });
const fileId = detail.files[0]?.id;
if (!fileId) throw new Error("Linked evidence file was not returned to the client");
const clientFile = await request(`/api/files/${fileId}`, { cookie: clientCookie });
const freelancerFile = await request(`/api/files/${fileId}`, { cookie: freelancerCookie });
const outsiderFile = await request(`/api/files/${fileId}`, { cookie: outsiderCookie });
if (clientFile.response.status !== 200 || freelancerFile.response.status !== 200) {
  throw new Error("A project participant could not read the live evidence file");
}
if (outsiderFile.response.status !== 403) {
  throw new Error(`Outsider file access returned ${outsiderFile.response.status}, expected 403`);
}

const approveReceipt = await writeContract(wallets.client, {
  address: escrow,
  abi: escrowAbi,
  functionName: "approveMilestone",
  args: [projectId, 0n],
});
const [finalProject, finalMilestone, freelancerTokenBalance] = await Promise.all([
  publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "getProject", args: [projectId] }),
  publicClient.readContract({ address: escrow, abi: escrowAbi, functionName: "getMilestone", args: [projectId, 0n] }),
  publicClient.readContract({ address: mockUsdc, abi: tokenAbi, functionName: "balanceOf", args: [freelancer.address] }),
]);
if (finalProject.status !== 3 || finalProject.releasedAmount !== milestoneAmount) {
  throw new Error("Project did not reach Completed with the exact released amount");
}
if (finalMilestone.status !== 2 || freelancerTokenBalance !== milestoneAmount) {
  throw new Error("Milestone or freelancer token balance is incorrect after approval");
}

console.log(
  JSON.stringify(
    {
      chainId: monadTestnet.id,
      origin,
      participants: {
        deployer: deployer.address,
        client: client.address,
        freelancer: freelancer.address,
        outsider: outsider.address,
      },
      fundingTransactions,
      project: {
        draftId: draft.id,
        onchainProjectId: projectId.toString(),
        status: "Completed",
        releasedAmount: finalProject.releasedAmount.toString(),
      },
      transactions: {
        create: createReceipt.transactionHash,
        faucet: faucetReceipt.transactionHash,
        approval: approvalReceipt.transactionHash,
        fund: fundReceipt.transactionHash,
        accept: acceptReceipt.transactionHash,
        submit: submitReceipt.transactionHash,
        approve: approveReceipt.transactionHash,
      },
      privacy: {
        outsiderProjectStatus: outsiderProjectRead.response.status,
        clientFileStatus: clientFile.response.status,
        freelancerFileStatus: freelancerFile.response.status,
        outsiderFileStatus: outsiderFile.response.status,
      },
      balances: {
        deployerMon: formatEther(await publicClient.getBalance({ address: deployer.address })),
        freelancerMockUsdc: freelancerTokenBalance.toString(),
      },
    },
    null,
    2,
  ),
);
