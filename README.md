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

## Verified mainnet evidence

The hosted indexer now contains the real CHOG Trade event, and the live mission completed a native MON payout.

- [Product](https://app.hodlerstation.xyz) and [verified mission](https://app.hodlerstation.xyz/missions/cmv4wq07u054211aojvtsdwpc).
- [CHOG purchase](https://monadscan.com/tx/0xad512008b8e9b8d6c7c96c809fe3e6f047382caacd6fc58d9129743357ffbc44).
- [0.0001 MON payout](https://monadscan.com/tx/0x356aea77316864a4ce58c2ea665d6530188c7f22e93a9f0a7a707dbddce0c293), successful receipt on chain143, exact recipient balance increase, one finalized payout after concurrent repeat claims.
- [Public evidence](submission/evidence.json) includes the actual indexed event.
- [Submission answers and judge instructions](submission/fields.json).

Dynamic real-wallet Sandbox authentication and message signing were checked separately. This production payout does not establish a new Dynamic login in that same session. Public CHOG reward payout is not claimed. The application uses its existing private mission and accounting services; this repository exposes the chain-specific integration, not production user data or keys.

The reward display and Monad explorer link were checked on the deployed product. Post-deployment checks passed 14 live API/network-visibility cases and 9 local-verifier cases against public Monad RPC and the hosted Envio indexer. Concurrent repeat claims retained one finalized 0.0001 MON payout. This recheck reused the completed mission; it did not create another payout.

Real MetaMask checks also verified message signing, BSC-to-Monad network switching, persistence after reload, and user-rejected signing. Dynamic connect-only mode is independent of the host login. Account linking and public CHOG reward payouts are not claimed.

## Reproducibility, authorship and licensing

### Public browser demo

With Node 24, run `cd modules`, `npm ci`, then `npm run demo`. Open
`http://localhost:5173`. Use your own public Dynamic environment ID and allow
this origin in that environment. Never enter a private key or server token.
Connect an external wallet, optionally switch to Monad and sign the clearly
labelled verification message. Rejecting the signature produces an error, not a pass.
The demo uses the same public Dynamic/EIP-1193 modules as the host application.

The evidence button works independently of wallet connection. It queries public
Monad RPC, checks canonical/finalized Trade evidence, requires the exact Envio
record, and verifies the recorded native MON payment. It does not authorize a
new participant, create a mission, or send funds. RPC/GraphQL CORS and service
availability are necessary for browser replay. `npm run demo:build` creates a
static build in `modules/demo-dist`; `npm test` includes failure-path replay tests.

This demo closes the missing public integration runner gap. It does **not**
replace the private mission/authentication/accounting services or establish
compliance with a requirement to publish the entire production application.

**Scope:** this is a runnable indexer plus testable integration modules, not a standalone clone of the complete mission application. A fresh clone cannot reproduce mission creation through production Claim without the private host. Do not interpret module tests as that full flow. See [source boundaries and dated changes](submission/SOURCE_PROVENANCE.md).

For the public modules with Node 24:

```sh
cd modules
npm ci
npm test
npm run typecheck
```

[MIT LICENSE](LICENSE) covers the HodlerStation-authored source published in this repository. MIT is [OSI approved](https://opensource.org/license/mit). Private product repositories and third-party rights are excluded from this grant. See [external component sources](THIRD_PARTY_NOTICES.md) and [AI coding assistance disclosure](submission/AI_USAGE.md).

[Dependency security review](submission/DEPENDENCY_SECURITY.md) records individual findings, locked repairs, compatibility tests and consumer limitations.

## Indexer reliability

Local HyperSync access requires an ENVIO_API_TOKEN in the process environment (obtain it from your Envio organisation). This is distinct from an optional GraphQL query API key sent as a Bearer token by the mission adapter; never use the HyperSync credential as the GraphQL key. Cloud manages its own data-source connection.

The checked-in config supports only chain 143 and its listed Chog contract. Consumers must explicitly pass that scope to the adapter; adding a testnet or changing the contract requires corresponding indexer configuration and event tests. Scope failures and transport failures must not fall back to unconditional RPC approval.

CI retains the npm lock-based build and additionally runs pnpm 10.32.0 on Linux without the pnpm lock to match Cloud dependency resolution. Check GraphQL _meta.isReady and progressBlock against sourceBlock as well as the expected event; an Active label alone is insufficient. Development deployments have a maximum 30-day lifespan and are not permanent production hosting. See [Cloud troubleshooting](https://docs.envio.dev/docs/HyperIndex/envio-cloud-troubleshooting) and [plan limits](https://docs.envio.dev/docs/HyperIndex/hosted-service-billing).

Read-only readiness and the recorded mainnet event can be checked with `node tools/check-indexer.mjs <https-graphql-endpoint>`. It reports readiness, block lag and exact event matching separately. For a private query endpoint only, supply ENVIO_GRAPHQL_API_KEY in the process environment. The command does not send transactions.

## Dynamic session boundary

This integration uses the installed legacy React SDK 5.10.0 in connect-only mode. A connected wallet does not authenticate the host account or authorize a reward; the private host retains its own session and canonical proof checks. SDK readiness and host-session hydration are both required before exposing restored accounts. Account changes block old clients until logout completes and the SDK clears its primary wallet. Connection requests share one pending dialog; cancellation, failure and timeout settle pending callers. Signature results from a replaced account are rejected, but already-broadcast transaction hashes are preserved for reconciliation.

Official references: [SDK loading](https://www.dynamic.xyz/docs/react/reference/loading-login-states), [events](https://www.dynamic.xyz/docs/react/reference/hooks/usedynamicevents), [go-live checklist](https://www.dynamic.xyz/docs/get-started/go-live-checklist). Existing installations should follow their SDK generation; migration to the newer JavaScript SDK is a separate compatibility project. Live environment IDs/CORS and cross-device external-wallet behavior require deployment checks; unit tests do not establish those settings. A failed logout keeps signing blocked until the SDK clears the session (or the page is reloaded).
