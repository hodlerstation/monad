# External components and attribution

The MIT license in this repository applies to HodlerStation-authored code and documentation published here. It does not relicense third-party packages, Monad/Dynamic/Envio/Chog names or logos, or unpublished HodlerStation repositories.

| Component | Source | Use |
| --- | --- | --- |
| Envio HyperIndex | https://github.com/enviodev/hyperindex | Indexer runtime and generated bindings |
| Dynamic SDK | https://www.dynamic.xyz/docs | Wallet connection and signing bridge |
| viem | https://github.com/wevm/viem | EVM encoding, signing and receipt handling |
| React | https://github.com/facebook/react | Dynamic provider lifecycle |
| Vitest | https://github.com/vitest-dev/vitest | Module test runner |
| TypeScript | https://github.com/microsoft/TypeScript | Type checks |
| Foundry Anvil | https://github.com/foundry-rs/foundry | Local EVM tooling |
| Solidity compiler | https://github.com/ethereum/solidity | Local contract tooling |

Exact package versions are recorded in the root and modules package-lock.json files. Each dependency retains its own license and notices; consult the installed package's LICENSE and package.json before redistribution. This list is not an exhaustive transitive-dependency license audit.

The Trade ABI in config.yaml describes the existing Chog market at the documented address. The market contract implementation was not copied into this repository and is not claimed as newly authored here. Public modules were extracted/adapted from HodlerStation's own integration work; see submission/SOURCE_PROVENANCE.md. This is not a line-by-line third-party code provenance audit.
