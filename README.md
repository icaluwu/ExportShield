# ExportShield

ExportShield is an English-language hackathon MVP for milestone escrow on Monad Testnet. A client locks six-decimal MockUSDC, a freelancer accepts and submits private evidence, and the client releases one exact milestone payment at a time.

> Testnet only. There is no arbitration, active-project refund, or automatic release after acceptance. Funds may remain locked if the client stops responding. The contracts are not audited and must not be used with assets of economic value.

Live demo: <https://exportshield.pages.dev> · [deployment evidence](DEPLOYMENT.md)

## Architecture

- `apps/web`: Next.js static export plus Cloudflare Pages Functions
- `packages/contracts`: Hardhat 3 contracts, tests, and Ignition module
- `packages/shared`: canonical schemas, deterministic JSON, and hash helpers
- `packages/contract-config`: committed ABI/deployment metadata boundary
- D1: private participant metadata, linkage records, nonces, and hashed sessions
- private R2: evidence objects, streamed only after participant authorization
- Monad Testnet: authoritative financial lifecycle

## Local setup

Requirements: Node.js 22+, pnpm 11.18.0, and two disposable test wallets. Never place a funded mainnet private key in this repository.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example apps/web/.env.local
pnpm contracts:compile
pnpm --filter @exportshield/web build
```

The committed public defaults use the Reown `IcalUwU / Moned` project and the verified Monad Testnet deployment. Override them in `apps/web/.env.local` only when testing another deployment. For local Pages Functions create `apps/web/.dev.vars` with `MONAD_RPC_URL`, `ESCROW_CONTRACT_ADDRESS`, `SIGNATURE_DOMAIN=localhost:8788`, and `SESSION_COOKIE_SECURE=false`. Do not commit `.dev.vars`.

Apply local storage and start Pages after the static build:

```powershell
Set-Location apps/web
wrangler d1 migrations apply DB --local
pnpm preview
```

## Contracts

`MockUSDC.faucet()` grants 10,000 mUSDC per address once per hour. `MilestoneEscrow` is non-upgradeable, accepts only that immutable token, and is deployed with a three-day acceptance period.

```powershell
pnpm contracts:test
pnpm contracts:coverage
pnpm --filter @exportshield/contracts deploy:testnet
```

The deployment key belongs only in a local environment variable or CI secret. The current verified addresses, deployment block, chain ID, and verification URL are committed in `packages/contract-config/src/addresses/monad-testnet.json`; public release evidence is recorded in `DEPLOYMENT.md`.

## Cloudflare Pages

Create a D1 database and private R2 bucket, replace the D1 ID in `apps/web/wrangler.jsonc`, then apply migrations remotely:

```powershell
Set-Location apps/web
wrangler d1 migrations apply DB --remote
```

Configure the Pages project with root directory `apps/web`, build command `pnpm --filter @exportshield/web build`, and output directory `out`. Add public build variables from `.env.example`; add runtime values through Cloudflare project variables/secrets. Keep `SESSION_COOKIE_SECURE=true` in deployed environments.

Do not copy RPC or explorer endpoints from old examples. Refresh them from official Monad network information immediately before deployment. Final acceptance also requires a real two-wallet smoke run and a third-wallet privacy check; local tests alone do not establish deployment readiness.

## API response shape

Success responses use `{ "data": ... }`. Failures use `{ "error": { "code", "message", "details"? } }`. Protected mutations enforce same origin, SIWE session, participant role, content type, rate limits, and confirmed transaction details when linking.

## Validation

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm contracts:coverage
pnpm build
git diff --check
```
