# HodlerStation × Monad

This repository owns the portable Monad integration source. The existing product's user accounts, mission eligibility, budgets, claim accounting and recovery orchestration remain private.

## Reviewable implementation

- `modules/dynamic-wallet-provider.tsx`: actual Dynamic SDK bridge, accepting the host app's session identity and supported networks through props. It does not replace product authentication.
- `modules/wallet-provider.ts`: standard EIP-1193 boundary for connect, signing, transaction requests, cancellation and account/network changes.
- `modules/native-transfer.ts`: Monad native/ERC-20 transfer signing, persisted-byte verification and canonical finalized receipt verification. A submitted hash is never sufficient proof of payment.
- `modules/mission-event-source.ts`: replaceable indexer interface. The host must establish canonical evidence before querying an indexer.
- `modules/envio-mission-event-source.ts`: GraphQL evidence matching; unavailable indexing never authorizes a claim.
- `config.yaml`, `schema.graphql`, `src/`: deployable Envio indexer for the existing Chog Trade event.

## Consumption without exposing private application code

Portable modules are the source of truth here. The private frontend/backend compile checked-in vendor snapshots from this repository; they do not download code during runtime or deploy. `src/vendor/monad/source.json` in each consumer records the commit and SHA-256 hashes. Do not edit generated snapshots by hand.

After reviewing and committing changes here, run:

```
node tools/sync-modules.mjs frontend /path/to/hodlerstation-app
node tools/sync-modules.mjs backend /path/to/hodlerstation-backend
```

The same commands with `--check` reject drift. Consumer tests and changes must be committed together. Updating a module does not automatically deploy the product.

Reviewers need this repository and a running product/demo to inspect the integration; private mission/accounting implementations are not published. This separation does not itself assert compliance with any organizer's source-access rules.

## Module tests

Use Node 24. In `modules`, run `npm install`, `npm test`, and `npm run typecheck`. Dependencies are declared there, separately from Envio. Tests cover wallet requests/cancellation, indexer evidence rejection and exact native-token signing. These tests use generated local keys; they do not transfer public funds. Product lifecycle tests remain with the private host application because they exercise its existing claim/refund accounting.

## Envio Cloud

Connect this repository, root `.`, config `config.yaml`, branch `master`. The indexer targets Monad mainnet143 and Chog market `0x43dD6Ba111b09e2ee318666B82eA279Dd290BA89`, starting at block111647728. The modules folder does not alter indexer handler discovery (`handlers: src`). No new contract deployment is required.

At repository root, use `npm ci`, `npm run codegen`, `npm run typecheck`, `npm run dev` on Linux with Docker. Envio Cloud manages its HyperSync connection. Keep secrets outside Git.

## Claim and signing boundary

The host's existing Claim endpoint validates eligibility and reserves the mission budget. The server selects its existing encrypted Treasury wallet and persists signed transaction bytes before broadcasting. Uncertain RPC results retain the same bytes/hash/nonce for recovery. Accounting marks payment complete only after canonical finality verification.

Chog administrator address `0x8c4c0E65A479629311AaF3a0398Afa9A8aB50f70` is also the host's BSC FEE_COLLECTOR. Monad native rewards can reuse that existing signer on the Monad chain through the host Treasury service. No key is copied into this repository. Existing dedicated MON custody is retained for compatibility. Sharing an address across chains does not share their balances or nonce sequences.

The Chog ERC-20 market and MON native rewards are distinct assets. The shared transfer module supports exact ERC-20 calldata and finalized Transfer-log verification. The host selects the fixed mainnet CHOG contract, keeps asset budgets separate, and reserves MON for gas; CHOG is not enabled on testnet without an independently configured contract.

## Evidence limits

Local successful tests are not public-chain payment proof. Hosted Envio was reachable but had zero indexed Trade events at the last check. A positive public event and actual public MON payout remain unverified. No private key, private product implementation or production user data is needed in this repository.
