# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **CIP-8 / COSE_Sign1 witnesses now verify end-to-end.** CIP-100 metadata may carry witnesses with `witnessAlgorithm: "CIP-8"` / `"CIP-0008"` (a COSE_Sign1 envelope from CIP-8 Cardano Message Signing). Previously these were schema-rejected; then schema-accepted but reported as `signatureValid: false`. `cip100.verify` now CBOR-decodes the COSE_Sign1, binds the payload to `blake2b256(canonical body)`, reconstructs the Sig_structure per RFC 8152, and verifies the inner ed25519 signature. Validated against EMURGO's real mainnet witness on `emurgo-sponsorship` — every multi-author Intersect treasury proposal now verifies cleanly with no consumer-side setup. Implemented with `cbor2` (111 KB hard dep), no peer-dep dance.
- **Schema rejected `witnessAlgorithm: "CIP-8"` / `"CIP-0008"`.** CIP-100 spec allows both `ed25519` and `CIP-8` (Cardano Message Signing). The schema only accepted `ed25519`, so any real-world doc with a CIP-8 witness failed validation. Schema now accepts all three.
- **Bundled JSON-LD contexts now actually load.** Previous releases imported `.jsonld` files via Bun's default file loader, which returned the **file path** instead of the parsed JSON. As a consequence, `canonicalizeBody` and any signature verification path failed with `JSON Parse error: Unrecognized token '/'`. Imports now use `with { type: "json" }` attributes so the contents are inlined as JSON.
- **`verifyEd25519Signature` no longer throws on first call.** Was using `@noble/ed25519`'s sync `verify`, which requires `etc.sha512Sync` to be configured at module load — without it, the first verify threw `hashes.sha512Sync not set`. Switched to `verifyAsync`. The function now also catches malformed-input errors and returns `false`.
- **Witness signatures are computed over the body envelope, not the whole document.** Per CIP-100, witnesses sign the canonicalized form of `{ "@context", body }`. The previous implementation canonicalized the entire document including the `authors` array, which made signing logically circular (the witness had to sign over a document that contained its own signature) and produced verification failures. Fixed in `cip100/verify.ts`.
- **Canonicalization rejects unmapped body fields (security).** The previous build ran `jsonld.canonize` with `safe: false`, which silently dropped any term not mapped by the `@context` from the canonical N-Quads. Combined with `passthrough()` schemas, an attacker could append a body field that a consumer of `result.data.document.body.X` would read while the witness signature (computed over the canonical form) would still verify. Canonicalization now uses a custom event handler that throws `CANONICALIZATION_FAILED` on every data-loss warning (`invalid property`, `free-floating scalar`, `null @id/@value value`, etc.) while still accepting the cosmetic `relative @type/@id/@vocab/object/predicate/subject/graph reference` warnings the published CIP-100 contexts unavoidably emit. **Breaking** for any document with body fields outside the `@context`.
- **CIP-169 `parameter_change_action` now decodes.** The encoder was calling `a.protocol_param_update()` (singular); the actual CSL method is `protocol_param_updates()` (plural).

### Added

- **Public CIP-8 verifier**: `verifyCip8Witness(coseHex, expectedPayloadBytes, publicKeyHex)` and `decodeCoseSign1(coseHex)` exported from the root entry — usable directly without a full CIP-100 document. Supports `unprotected.hashed = false` (every real-world fixture uses this); `hashed: true` returns a diagnostic `unsupportedReason` until a real fixture motivates support.
- **`WitnessVerificationResult` extended** with `witnessAlgorithm` (which algorithm was verified) and an optional `unsupportedReason` (diagnostic; set only on structural failures like malformed COSE envelopes). Existing callers checking `signatureValid` keep working unchanged.
- `docs/architecture.md` — pipeline overview, design rationale (Result types, JSON-LD canonicalization, peer-dep CSL pattern, layering).
- `docs/examples/README.md` — index of all examples with prerequisites and how to run.
- `docs/examples/cip169-compare.ts` — diff two `onChain` values without a transaction.
- `docs/examples/cip169-verify-tx.ts` — now self-contained: builds a real Conway tx via CSL inline (was a truncated CBOR placeholder).
- `docs/examples/context-allowlist.ts` — runnable end-to-end (was reading a non-existent fixture file).
- README — Troubleshooting section, expanded CIP-169 walkthrough with three sub-examples (compare, single-action verify, multi-action selector), CIP spec links per row, link to architecture doc.
- JSDoc on every public-API function (`fetchMetadata`, `resolve`, `detectCipStandard`, `registerContext`, `createDocumentLoader`, `hashBlake2b256`, `bytesToHex`, `hexToBytes`, `canonicalizeBody`, `verifyEd25519Signature`, `setCardanoSerializationLib`, each `cipNNN.parse`/`validate`/`verify`, `compareOnChain`, `verifyAgainstTx`, `decodeConwayTx`).
- Test coverage went from ~45% lines / ~67% functions to **95% / 99%**. New test files: `core/__tests__/{hex,hash,verify-signature,canonicalize,fetcher}.test.ts`, `cip{100,108,119,136}/__tests__/cip*.test.ts`, `cip169/__tests__/decode-tx-actions.test.ts`, `__tests__/{exports,examples}.test.ts`. A shared `__tests__/helpers/cip-suite.ts` runs the same parse/validate/verify battery against each CIP.
- **Real-world golden test suite** (`__tests__/real-fixtures.test.ts`) running against four mainnet 2026 submissions from `IntersectMBO/governance-actions` (`tweag-twa`, `emurgo-sponsorship`, `emurgo-sponsorship-upgrade`, `budget-process-info`). Confirms canonicalize/hash/ed25519 interop with whatever tooling Intersect used to sign these. Also surfaces a real-world data issue: production metadata documents currently omit `gov_action.policy_hash` that the on-chain proposal carries — `verifyAgainstTx` correctly diffs this, demonstrating CIP-169's value as a metadata-replay guard.
- GitHub Actions CI workflow: lint + type-check + test on push and pull_request.

## [0.1.0] - 2026-05-08

Initial release.

### Added

- CIP-100 — base governance metadata: parse, validate, verify.
- CIP-108 — governance action metadata.
- CIP-119 — DRep registration metadata.
- CIP-136 — constitutional committee vote metadata.
- CIP-169 — on-chain effects: parse, validate, verify-against-tx, Conway transaction decoding, self-anchor stripping, document compare.
- `resolve()` one-shot: fetch + detect + parse + validate + signature verify + anchor-hash check.
- `detectCipStandard()` for distinguishing CIP-100 extensions.
- `fetchMetadata()` with IPFS and Arweave URI support and caller-injectable fetch.
- JSON-LD context registry with bundled offline contexts for all five CIPs.
- Caller-injects pattern for Cardano Serialization Library (CSL) via `setCardanoSerializationLib()`; CSL declared as optional peer dependency across `nodejs` / `browser` / `asmjs` builds.
- Per-CIP subpath exports (`/cip100`, `/cip108`, `/cip119`, `/cip136`, `/cip169`) for tree-shaking.
- Result-typed API across the public surface (`{ success: true, data } | { success: false, error }`) with machine-readable error codes.
