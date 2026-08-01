# Security policy

ExportShield is a testnet-only hackathon MVP and has not been professionally audited. Do not deploy it to mainnet or use assets with economic value.

Report suspected vulnerabilities privately to the repository owner. Do not include private keys, session cookies, uploaded evidence, wallet signatures, or participant metadata in an issue. Reproduction should use local accounts and testnet assets only.

The intended trust boundary is: financial state is authoritative only on `MilestoneEscrow`; D1 holds private metadata/linkage; R2 holds private evidence; Pages Functions authenticate and authorize every private read or mutation.
