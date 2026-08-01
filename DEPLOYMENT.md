# ExportShield Testnet Deployment

Verified on 2026-08-01. This deployment is a testnet-only hackathon demonstration and is not an audited or mainnet-ready escrow.

## Application

- Production URL: <https://exportshield.pages.dev>
- Immutable release URL: <https://c17b9c0b.exportshield.pages.dev>
- Cloudflare resources: Pages `exportshield`, D1 `exportshield-db`, private R2 `exportshield-files`
- Reown project: `IcalUwU / Moned`
- Reown Project ID: `e4ddd96c55a3ccf57f49d3aac4e0dd59`
- Reown domain allowlist: `https://exportshield.pages.dev`
- Health result: D1, R2, and Monad RPC all ready

## Monad Testnet contracts

- Chain ID: `10143`
- MockUSDC: [`0xDa61b5aE9662C1c9f783f79Dd9c400eAeeEfDD85`](https://testnet.monadexplorer.com/address/0xDa61b5aE9662C1c9f783f79Dd9c400eAeeEfDD85)
- MilestoneEscrow: [`0x8C8f2534DAAFc17fd5c8a681B908D4a3D2ffb99C`](https://testnet.monadexplorer.com/address/0x8C8f2534DAAFc17fd5c8a681B908D4a3D2ffb99C)
- MockUSDC deployment block: `49811671`
- MilestoneEscrow deployment block: `49811684`
- Acceptance period: `259200` seconds (three days)
- MockUSDC deployment transaction: [`0x9b84826c0874eb5f7d7b54c038ca8d8e8984c5a8de2dfcf1995b3bae4a64d554`](https://testnet.monadexplorer.com/tx/0x9b84826c0874eb5f7d7b54c038ca8d8e8984c5a8de2dfcf1995b3bae4a64d554)
- MilestoneEscrow deployment transaction: [`0x8e166e43485281f6ab9bd96230fe8421aab33c54772faf729a6ec4f0720b4776`](https://testnet.monadexplorer.com/tx/0x8e166e43485281f6ab9bd96230fe8421aab33c54772faf729a6ec4f0720b4776)
- [MockUSDC source verification](https://sourcify-api-monad.blockvision.org/repo-ui/10143/0xDa61b5aE9662C1c9f783f79Dd9c400eAeeEfDD85)
- [MilestoneEscrow source verification](https://sourcify-api-monad.blockvision.org/repo-ui/10143/0x8C8f2534DAAFc17fd5c8a681B908D4a3D2ffb99C)

## Live acceptance evidence

A real three-wallet smoke run completed project `0` with one `2.5 mUSDC` milestone:

- Client: `0x3cb7cf1415e318a1934b505CD1F9e9647DE3197D`
- Freelancer: `0xE474034521d2ECD89FafC0B110312c8d6d61b05D`
- Unrelated privacy-check wallet: `0x4AD4c88B90532137Cd9B90e358aE47AA11508e66`
- Create: [`0x980906794ff231fc26a52156ff036ed9d5a3e0ea08973fb2a6696deaad19e740`](https://testnet.monadexplorer.com/tx/0x980906794ff231fc26a52156ff036ed9d5a3e0ea08973fb2a6696deaad19e740)
- Faucet: [`0xeff8f1ab84e08d83e4ac2b8eaa2bcf83a48c825fe5d866393da62f64918a19e7`](https://testnet.monadexplorer.com/tx/0xeff8f1ab84e08d83e4ac2b8eaa2bcf83a48c825fe5d866393da62f64918a19e7)
- Exact approval: [`0x313aaf55f910862206a6409266bf9917d62612086911ed8e3d9596abfd7db293`](https://testnet.monadexplorer.com/tx/0x313aaf55f910862206a6409266bf9917d62612086911ed8e3d9596abfd7db293)
- Fund: [`0xfb06091c6774a5a1890f0b2b0c6049c6bb4c17d8c58a0e5d5c018b493a2087df`](https://testnet.monadexplorer.com/tx/0xfb06091c6774a5a1890f0b2b0c6049c6bb4c17d8c58a0e5d5c018b493a2087df)
- Accept: [`0x3a95d5394b0787adb14dd3933b68a1125944565f1c42fd9887d595b42ec44699`](https://testnet.monadexplorer.com/tx/0x3a95d5394b0787adb14dd3933b68a1125944565f1c42fd9887d595b42ec44699)
- Submit: [`0x416b425f28adbdde1a31a2bf2d87136018315bee1e43a1ee15d15344fefedaa6`](https://testnet.monadexplorer.com/tx/0x416b425f28adbdde1a31a2bf2d87136018315bee1e43a1ee15d15344fefedaa6)
- Approve/release: [`0x70c7735f11a20bb1879bf236dd63700ed2fd8b4744d5ad75a0dadb13e790c032`](https://testnet.monadexplorer.com/tx/0x70c7735f11a20bb1879bf236dd63700ed2fd8b4744d5ad75a0dadb13e790c032)

The final project state was `Completed`, released amount was exactly `2500000` base units, and the freelancer balance increased by that exact amount. Both participants received HTTP 200 for the private evidence file. The unrelated wallet received HTTP 403 for both project metadata and evidence.

## Verification summary

- Contract unit and invariant suite: 11 passed
- Contract line/statement coverage: 100%
- Shared canonicalization tests: 2 passed
- Web and Functions unit tests: 5 passed
- Production static build: passed
- Production Playwright route and AppKit modal checks: Chromium desktop and mobile, 4 passed
- Live SIWE: nonce, verify, session, logout, and nonce-replay rejection passed
- Live on-chain/API/storage lifecycle: passed

Private keys and session tokens are not recorded in this repository. The reusable live smoke runner reads disposable test-wallet keys only from environment variables and requires `LIVE_SMOKE_CONFIRM=YES` before making state changes.
