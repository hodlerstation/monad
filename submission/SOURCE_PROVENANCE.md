# Source provenance and hackathon scope

HodlerStation existed before this submission. We do not claim the whole product was created for the hackathon.

| Existing infrastructure reused | Monad-specific work exposed here |
| --- | --- |
| User accounts, creator/admin roles, mission creation and eligibility | EIP-1193 wallet adapter and Dynamic SDK bridge |
| Claim budget reservation, accounting and recovery orchestration | Exact MON/ERC-20 signing and finalized receipt verification |
| Existing Chog market and its Trade event | Envio Trade handler, schema and evidence matching adapter |

## Public history that reviewers can inspect

- [c36627a](https://github.com/hodlerstation/monad/commit/c36627a): indexer extracted from the existing backend, 2026-10-12.
- [c945f82](https://github.com/hodlerstation/monad/commit/c945f82): portable wallet and settlement adapter ownership moved into this repository, 2026-10-12.
- [6d5cf8d](https://github.com/hodlerstation/monad/commit/6d5cf8d): shared ERC-20 transfer receipt verification, 2026-10-12.
- [8df552f](https://github.com/hodlerstation/monad/commit/8df552f): cross-platform committed-source provenance checks, 2026-10-12.

These are public extraction/refinement dates, not a claim that every extracted line was first authored then. Original product integration history remains in private repositories. Public commit dates alone do not prove the complete original development chronology or satisfy an organizer's source-access policy.

Use `git log --date=iso-strict --format='%h %ad %s' -- modules src` and `git show <commit>` to inspect the actual changes. The repository was separated to publish chain-specific code without publishing unrelated product code. No history was backdated for the submission.

## Reproduction boundary

The public browser demo and indexer can be installed separately. The newly authored
`modules/reference-host/` supplies an independent local HTTP authentication and
mission server with SQLite state and retry-safe local settlement. Its integration
test reproduces admin creation through participant Claim against fresh Anvil funds
and the real Envio handler simulator. See `npm run reference:verify` in the README.
This reference was added on 2026-10-13; it is not extracted private host accounting.

Dynamic browser signing and the local mission lifecycle remain separate test paths.
The simulator is not production HyperSync ingestion. The live product and recorded
mainnet evidence are described in the root README. This public reference does not
publish the existing private product, nor prove compliance with an organizer rule
requiring that entire product's source.

## Latest public module check (2026-10-13)

Node 24.14.0: isolated `npm ci` with install scripts enabled, all 33 module tests and TypeScript checks passed. The public module audit improved from 32 affected package entries to zero; the separate indexer audit improved from 12 to zero. See [individual dependency analysis, remediation and limits](DEPENDENCY_SECURITY.md). These checks do not run a complete live Dynamic/Envio/Claim application.
