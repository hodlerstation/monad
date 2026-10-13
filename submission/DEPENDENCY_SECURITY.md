# Dependency security review — 2026-10-13

Scope: the public repository's two independent npm lockfiles. Counts below are affected package entries, including propagated parent dependencies, not unique vulnerabilities.

| Install | Before | After |
| --- | --- | --- |
| Public integration modules | 32 (18 high, 14 moderate) | 0 |
| Envio indexer | 12 (8 high, 1 moderate, 3 low) | 0 |

## Remediation decisions

- Axios: pin 1.20.0 to remove request mutation, prototype-pollution and denial-of-service advisories.
- UUID: replace vulnerable older versions with 11.1.1; preserve CommonJS callers.
- Sharp: update to 0.35.5 with repaired bundled image libraries.
- Solana JSON-RPC: use jayson 5.0.0 to remove the affected stream-json dependency; exercise the actual Solana Connection caller.
- bigint-buffer has no patched upstream release. Replace its four conversion functions with original, native-free JavaScript in modules/compat/bigint-buffer. Explicit bounds reject unsigned overflow and invalid widths. This removes native unsafe memory operations; it is not an advisory suppression. Tests assert the transitive Solana caller actually resolves this replacement.
- Keep Dynamic 5.10.0; do not accept npm's proposed downgrade to an incompatible old SDK.
- Indexer HTTP stack: Express 4.22.3, body-parser 1.20.6, path-to-regexp 0.1.13 and qs 6.16.0; Express also updates cookie, send and serve-static.
- Indexer tooling: tmp 0.2.7 and ws 8.22.0 remove path-traversal and denial-of-service advisories without changing Envio 3.14.0 or solc 0.8.37.

## Individual affected packages

Each row records the original audit's direct advisory or dependency that propagated the finding. Both resulting lockfiles pass npm audit with zero findings.

### Modules

| Package | Severity | Original cause | Resolution |
| --- | --- | --- | --- |
| @dynamic-labs-connectors/base-account-evm | high | @dynamic-labs/ethereum-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs-connectors/metamask-evm | high | @dynamic-labs/ethereum; @dynamic-labs/ethereum-core; @metamask/connect-evm; @metamask/connect-multichain | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs-sdk/client | moderate | @dynamic-labs-wallet/browser-wallet-client | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs-wallet/browser-wallet-client | moderate | @dynamic-labs-wallet/core; @dynamic-labs-wallet/core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs-wallet/core | moderate | axios; uuid | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/ethereum | high | @dynamic-labs-connectors/base-account-evm; @dynamic-labs-connectors/metamask-evm; @dynamic-labs/ethereum-core; @dynamic-labs/waas-evm; @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/ethereum-core | high | @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/iconic | high | sharp; sharp | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/multi-wallet | high | @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/sdk-react-core | high | @dynamic-labs-sdk/client; @dynamic-labs-wallet/browser-wallet-client; @dynamic-labs-wallet/core; @dynamic-labs/iconic; @dynamic-labs/multi-wallet; @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/solana-core | high | @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core; @solana/spl-token; @solana/web3.js | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/sui-core | high | @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/waas | high | @dynamic-labs-sdk/client; @dynamic-labs-wallet/browser-wallet-client; @dynamic-labs-wallet/core; @dynamic-labs/ethereum-core; @dynamic-labs/solana-core; @dynamic-labs/sui-core; @dynamic-labs/wallet-book; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/waas-evm | high | @dynamic-labs/ethereum-core; @dynamic-labs/waas; @dynamic-labs/wallet-connector-core | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/wallet-book | high | @dynamic-labs/iconic; @dynamic-labs/iconic | Removed or patched through the locked dependency changes above; clean audit |
| @dynamic-labs/wallet-connector-core | high | @dynamic-labs-sdk/client; @dynamic-labs-wallet/browser-wallet-client; @dynamic-labs-wallet/browser-wallet-client; @dynamic-labs-wallet/core; @dynamic-labs-wallet/core; @dynamic-labs/wallet-book; @dynamic-labs/wallet-book | Removed or patched through the locked dependency changes above; clean audit |
| @metamask/connect-evm | moderate | @metamask/connect-multichain; @metamask/utils | Removed or patched through the locked dependency changes above; clean audit |
| @metamask/connect-multichain | moderate | @metamask/mobile-wallet-protocol-dapp-client; @metamask/rpc-errors; @metamask/utils | Removed or patched through the locked dependency changes above; clean audit |
| @metamask/mobile-wallet-protocol-dapp-client | moderate | @metamask/utils | Removed or patched through the locked dependency changes above; clean audit |
| @metamask/rpc-errors | moderate | @metamask/utils | Removed or patched through the locked dependency changes above; clean audit |
| @metamask/utils | moderate | uuid | Removed or patched through the locked dependency changes above; clean audit |
| @solana/buffer-layout-utils | high | @solana/web3.js; bigint-buffer | Removed or patched through the locked dependency changes above; clean audit |
| @solana/spl-token | high | @solana/buffer-layout-utils; @solana/spl-token-group; @solana/spl-token-metadata; @solana/web3.js | Removed or patched through the locked dependency changes above; clean audit |
| @solana/spl-token-group | moderate | @solana/web3.js | Removed or patched through the locked dependency changes above; clean audit |
| @solana/spl-token-metadata | moderate | @solana/web3.js | Removed or patched through the locked dependency changes above; clean audit |
| @solana/web3.js | moderate | jayson | Removed or patched through the locked dependency changes above; clean audit |
| axios | high | [Axios: Prototype pollution auth subfields can inject Basic auth ](https://github.com/advisories/GHSA-xj6q-8x83-jv6g); [Axios: Prototype pollution gadgets can alter axios request construction ](https://github.com/advisories/GHSA-mmx7-hfxf-jppx); [Axios: Deep formToJSON Key Recursion Can Cause Denial of Service ](https://github.com/advisories/GHSA-pmv8-rq9r-6j72); [Axios: HTTP/2 streamed uploads bypass `maxBodyLength` ](https://github.com/advisories/GHSA-mwf2-3pr3-8698); [Axios Node HTTP adapter can use an inherited proxy after interceptor config cloning ](https://github.com/advisories/GHSA-gcfj-64vw-6mp9); [Axios: Nested axios option objects can consume polluted prototype values ](https://github.com/advisories/GHSA-7q8q-rj6j-mhjq); [Axios: Fetch adapter `ReadableStream` uploads bypass `maxBodyLength` ](https://github.com/advisories/GHSA-jqh4-m9w3-8hp9); [Axios: NO_PROXY bypass for 0.0.0.0 local addresses in axios ](https://github.com/advisories/GHSA-f4gw-2p7v-4548); [Axios: Excessive recursion in formDataToJSON can cause denial of service ](https://github.com/advisories/GHSA-42h9-826w-cgv3); [Axios form serializer maxDepth bypass via {} metatoken ](https://github.com/advisories/GHSA-hcpx-6fm6-wx23); [Axios: Prototype pollution gadget in fetch adapter can alter outbound requests ](https://github.com/advisories/GHSA-vh66-26gq-q6x8); [Axios: Prototype-Pollution Gadget in the Default Instance Allows Inherited Object.prototype.method to Override HTTP Method ](https://github.com/advisories/GHSA-9fr6-4gfg-395g); [Axios: ReDoS (O(N²)) in shouldBypassProxy host normalization, reachable via untrusted redirect Location ](https://github.com/advisories/GHSA-mghh-pgcx-3jjj); [Axios: Prototype Pollution Gadget in axios toFormData Options ](https://github.com/advisories/GHSA-x97p-jq2g-jp4f); [Axios: HTTP/2 adapter bypasses configured DNS lookup and proxy controls ](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v); [Axios: Denial of Service via Unhandled 'error' Event in HTTP/2 ClientHttp2Session Initialization ](https://github.com/advisories/GHSA-542g-h47m-68v8); [Axios: Header Injection via Inherited headers After Minimal Interceptor ](https://github.com/advisories/GHSA-j8rh-479h-cp32); [Axios: Fetch Adapter Header Injection via Inherited FormData getHeaders ](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2); [Axios: Node HTTP adapter prototype-pollution gadget allows request socket hijack via inherited createConnection ](https://github.com/advisories/GHSA-m8m8-qj5v-23w3); [Axios: CIDR-form NO_PROXY entries are ignored, causing proxy exclusion bypass for internal IP ranges ](https://github.com/advisories/GHSA-44g4-m2mj-wpvx) | Removed or patched through the locked dependency changes above; clean audit |
| bigint-buffer | high | [bigint-buffer Vulnerable to Buffer Overflow via toBigIntLE() Function ](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg) | Removed or patched through the locked dependency changes above; clean audit |
| jayson | moderate | stream-json; uuid | Removed or patched through the locked dependency changes above; clean audit |
| sharp | high | [sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545 ](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c); [sharp : Vulnerability in librsvg dependency CVE-2026-96889 ](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | Removed or patched through the locked dependency changes above; clean audit |
| stream-json | moderate | [stream-json: pick/ignore/filter/replace filters are O(depth²) on nested input — small crafted JSON blocks the event loop for seconds→minutes (DoS) ](https://github.com/advisories/GHSA-528h-pc64-c93x); [stream-json: JSONC parser and verifier re-scan the whole accumulated comment on every input chunk ](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x); [stream-json has a prototype pollution issue: Assembler writes this.current[this.key] on plain objects ](https://github.com/advisories/GHSA-mjw6-4jj6-33hc) | Removed or patched through the locked dependency changes above; clean audit |
| uuid | moderate | [uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided ](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Removed or patched through the locked dependency changes above; clean audit |

### Indexer

| Package | Severity | Original cause | Resolution |
| --- | --- | --- | --- |
| body-parser | high | [body-parser vulnerable to denial of service when url encoding is enabled ](https://github.com/advisories/GHSA-qwcr-r2fm-qrc7); [body-parser vulnerable to denial of service when invalid limit value silently disables size enforcement ](https://github.com/advisories/GHSA-v422-hmwv-36x6); qs | Removed or patched through the locked dependency changes above; clean audit |
| cookie | low | [cookie accepts cookie name, path, and domain with out of bounds characters ](https://github.com/advisories/GHSA-pxg6-pf52-xh8x) | Removed or patched through the locked dependency changes above; clean audit |
| envio | high | express; viem | Removed or patched through the locked dependency changes above; clean audit |
| express | high | [express vulnerable to XSS via response.redirect() ](https://github.com/advisories/GHSA-qw6h-vgh9-j6wx); body-parser; cookie; path-to-regexp; qs; send; serve-static | Removed or patched through the locked dependency changes above; clean audit |
| path-to-regexp | high | [path-to-regexp outputs backtracking regular expressions ](https://github.com/advisories/GHSA-9wv6-86v2-598j); [path-to-regexp contains a ReDoS ](https://github.com/advisories/GHSA-rhx6-c78j-4q9w); [path-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters ](https://github.com/advisories/GHSA-37ch-88jc-xwx2) | Removed or patched through the locked dependency changes above; clean audit |
| qs | moderate | [qs's arrayLimit bypass in comma parsing allows denial of service ](https://github.com/advisories/GHSA-w7fw-mjwx-w883); [qs's arrayLimit bypass in its bracket notation allows DoS via memory exhaustion ](https://github.com/advisories/GHSA-6rw7-vpxm-498p); [qs: Denial of Service via Attacker Controlled isBuffer ](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | Removed or patched through the locked dependency changes above; clean audit |
| send | low | [send vulnerable to template injection that can lead to XSS ](https://github.com/advisories/GHSA-m6fv-jmcg-4jfg) | Removed or patched through the locked dependency changes above; clean audit |
| serve-static | low | [serve-static vulnerable to template injection that can lead to XSS ](https://github.com/advisories/GHSA-cm22-4g7w-348p); send | Removed or patched through the locked dependency changes above; clean audit |
| solc | high | tmp | Removed or patched through the locked dependency changes above; clean audit |
| tmp | high | [tmp: Type-confusion bypass of _assertPath allows path traversal via non-string prefix/postfix/template ](https://github.com/advisories/GHSA-7c78-jf6q-g5cm) | Removed or patched through the locked dependency changes above; clean audit |
| viem | high | ws | Removed or patched through the locked dependency changes above; clean audit |
| ws | high | [ws: Memory exhaustion DoS from tiny fragments and data chunks ](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Removed or patched through the locked dependency changes above; clean audit |

## Verification and limits

- Windows Node 24: fresh isolated npm ci with install scripts enabled, 33 module tests and TypeScript check passed. No parent checkout dependencies are required.
- Thirteen additional cases cover little/big endian conversion, zero and maximum widths, unsigned overflow, invalid arguments, immutable input, actual Solana u64/u128/u256 callers, Solana RPC/jayson compatibility, UUID and Sharp.
- Linux CI installs both lockfiles, runs Envio code generation/typecheck, all module tests/typecheck, and both audits. Consult the PR check for its current result.
- A clean npm audit means no currently reported advisories in these resolved trees. It is not proof of absence of all vulnerabilities or a new real-wallet/live-payment test.
- npm overrides apply at the installation root. Consumers in private frontend/backend repositories do not automatically inherit these overrides. This change does not establish that those independent applications have clean dependency trees.
