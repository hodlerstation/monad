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

The public module tests and Envio indexer can be installed separately. This repository does **not** currently contain an independent mission web application, its authentication server, eligibility database, or Claim budget ledger. Module tests do not replace a full end-to-end reproduction of the private host application.

The live product and recorded mainnet evidence are described in the root README. Independent full-flow reproduction from only this repository is an unmet requirement if the organizer requires it. A standalone demonstrator would need an explicit public test host and locally funded settlement setup; it must not be represented as the private production accounting implementation.

## Latest public module check (2026-10-13)

Node 24.14.0: isolated `npm ci` with install scripts enabled, all 33 module tests and TypeScript checks passed. The public module audit improved from 32 affected package entries to zero; the separate indexer audit improved from 12 to zero. See [individual dependency analysis, remediation and limits](DEPENDENCY_SECURITY.md). These checks do not run a complete live Dynamic/Envio/Claim application.
