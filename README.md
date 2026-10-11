# HodlerStation × Monad

Independent Envio indexer for the existing Chogaton `Trade` event. This repository reads Monad; it does not hold payout keys or send MON.

## Envio Cloud

Connect `hodlerstation/monad`, branch `master`, root directory `.`, config file `config.yaml`. The configuration targets Monad mainnet (143), the existing market `0x43dD6Ba111b09e2ee318666B82eA279Dd290BA89`, from block 111647728. No new contract deployment is required.

The private repository must be accessible to the Envio GitHub app. Check build logs, sync progress and `MissionTrade` results before enabling the backend adapter. Use the dashboard's actual GraphQL endpoint; do not invent one.

## Development

Use Node 24 on Linux. Run `npm ci`, `npm run codegen`, `npm run typecheck`, then `npm run dev`. Local indexing requires Docker and a HyperSync access token when using HyperSync. Store secrets outside Git. Envio Cloud manages its own HyperSync access.

## Integration boundaries

| Repository | Responsibility |
| --- | --- |
| This repository | Envio configuration, schema, event handler and deployment instructions |
| hodlerstation-backend | Existing missions, approval, claims, refunds, MON chain adapter and Envio query adapter |
| hodlerstation-app | Existing mission/reward UI, Dynamic wallet adapter and network selection |

The existing Chogaton Solidity contracts remain in the backend repository: they are shared with the live Chogaton feature and its contract tests. Moving or duplicating those contracts would break that reuse. This indexer only needs the event signature in `config.yaml`.

Backend settings: `MISSION_EVENT_PROVIDER=envio`, `ENVIO_GRAPHQL_URL=<endpoint>`, and optional server-only `ENVIO_API_TOKEN` for GraphQL Bearer authentication. The last token is a query credential, not a HyperSync token. With `MISSION_EVENT_PROVIDER=rpc`, Envio is not queried. Indexer errors never silently approve missions through an RPC fallback.

Native MON payouts have no ERC transfer event. The existing backend checks their finalized receipts. This indexer records participation evidence, not native payment settlement.

## Verification and provenance

The indexer files were moved unchanged from `hodlerstation-backend/integrations/envio` at commit `8fef39e5eafb3c8cc7d2ce95e6d09f434f05a3c6`. Git history before the split remains in that repository.

Backend integration tests remain with the services they exercise. `integrations/envio/indexer-source.json` pins this repository's exact commit. Its Linux CI checks out that revision and runs real Envio → GraphQL → mission verification → local MON settlement. Local tests can use a matching checkout via `MONAD_INDEXER_ROOT`; no unpinned download occurs at runtime.

Local-chain tests and the separate real Dynamic Sandbox login are not evidence of a public MON payout or a running hosted indexer. Public hosting, activation and hackathon submission evidence must be verified separately.
