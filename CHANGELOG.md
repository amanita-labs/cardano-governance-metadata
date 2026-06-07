# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-06-07

### Fixed

- **CIP-169 `parameter_change_action` bindings no longer report false mismatches.** `verifyAgainstTx` decoded the on-chain action with CSL's `ProtocolParamUpdate.to_json()`, which emits the *full* parameter struct (every unset field as `null`) under **CSL's** field names, while CIP-116 metadata documents carry only the changed parameters under **CIP-116** names. A faithful binding (e.g. `{ committee_min_size: "5" }` vs the decoded `{ min_committee_size: 5, …32 nulls }`) diffed as ~34 spurious differences. The encoder now produces a sparse, CIP-116-shaped `protocol_param_update`: unset fields are dropped and the six fields whose CSL name diverges are renamed (`min_committee_size`→`committee_min_size`, `committee_term_limit`→`committee_max_term_length`, `governance_action_validity_period`→`gov_action_lifetime`, `governance_action_deposit`→`gov_action_deposit`, `drep_inactivity_period`→`drep_activity`, `ref_script_coins_per_byte`→`min_fee_ref_script_cost_per_byte`). `compareOnChain` additionally treats a JSON number and its decimal-string spelling as equal (e.g. metadata `"5"` vs decoded `5`) for any numeric field, not just `gov_action_index`. Comparison remains a full structural match (not a subset assertion), so a transaction that changes *more* parameters than the metadata declares is still correctly flagged. Verified against the real mainnet "reduce committeeMinSize 7→5" proposal.

## [0.1.1] - 2026-06-07

### Fixed

- **CIP-8 / COSE_Sign1 witnesses now verify end-to-end.** CIP-100 metadata may carry witnesses with `witnessAlgorithm: "CIP-8"` / `"CIP-0008"` (a COSE_Sign1 envelope from CIP-8 Cardano Message Signing). Previously these were schema-rejected; then schema-accepted but reported as `signatureValid: false`. `cip100.verify` now CBOR-decodes the COSE_Sign1, binds the payload to `blake2b256(canonical body)`, reconstructs the Sig_structure per RFC 8152, and verifies the inner ed25519 signature. Validated against EMURGO's real mainnet witness on `emurgo-sponsorship` — every multi-author Intersect treasury proposal now verifies cleanly with no consumer-side setup. Implemented with `cbor2` (111 KB hard dep), no peer-dep dance.
- **Schema rejected `witnessAlgorithm: "CIP-8"` / `"CIP-0008"`.** CIP-100 spec allows both `ed25519` and `CIP-8` (Cardano Message Signing). The schema only accepted `ed25519`, so any real-world doc with a CIP-8 witness failed validation. Schema now accepts all three.
- **Bundled JSON-LD contexts now actually load.** Previous releases imported `.jsonld` files via Bun's default file loader, which returned the **file path** instead of the parsed JSON. As a consequence, `canonicalizeBody` and any signature verification path failed with `JSON Parse error: Unrecognized token '/'`. Imports now use `with { type: "json" }` attributes so the contents are inlined as JSON.
- **`verifyEd25519Signature` no longer throws on first call.** Was using `@noble/ed25519`'s sync `verify`, which requires `etc.sha512Sync` to be configured at module load — without it, the first verify threw `hashes.sha512Sync not set`. Switched to `verifyAsync`. The function now also catches malformed-input errors and returns `false`.
- **Witness signatures are computed over the body envelope, not the whole document.** Per CIP-100, witnesses sign the canonicalized form of `{ "@context", body }`. The previous implementation canonicalized the entire document including the `authors` array, which made signing logically circular (the witness had to sign over a document that contained its own signature) and produced verification failures. Fixed in `cip100/verify.ts`.
- **Canonicalization rejects unmapped body fields (security).** The previous build ran `jsonld.canonize` with `safe: false`, which silently dropped any term not mapped by the `@context` from the canonical N-Quads. Combined with `passthrough()` schemas, an attacker could append a body field that a consumer of `result.data.document.body.X` would read while the witness signature (computed over the canonical form) would still verify. Canonicalization now uses a custom event handler that throws `CANONICALIZATION_FAILED` on every data-loss warning (`invalid property`, `free-floating scalar`, `null @id/@value value`, etc.) while still accepting the cosmetic `relative @type/@id/@vocab/object/predicate/subject/graph reference` warnings the published CIP-100 contexts unavoidably emit. **Breaking** for any document with body fields outside the `@context`.
- **CIP-169 `parameter_change_action` now decodes.** The encoder was calling `a.protocol_param_update()` (singular); the actual CSL method is `protocol_param_updates()` (plural).

### Added

- **Document `build()` factories** on every CIP module — the construction-side inverse of `parse`. `cip{100,108,119,136}.build({ body, authors?, context?, hashAlgorithm? })` assembles the JSON-LD envelope, injects the canonical `@context` URL and `hashAlgorithm: "blake2b-256"` default (both overridable), validates against the same schema `validate` uses, and returns `{ doc, json }` where `json` is the pretty-printed document. A successful build is guaranteed to round-trip through `parse`. Witness signing is out of scope — callers compose `authors[]` themselves.
- **CIP-169 build + action helpers.** `cip169.build(onChain)` validates a bare `OnChain` payload (proposal procedure / certificate / voting procedures) and returns `{ payload, json }` for nesting under any base CIP's `body.onChain`. `cip169.actions` adds pure type-narrowed constructors for every Conway governance action and no-anchor certificate/voter shape (`infoAction`, `parameterChange`, `hardForkInitiation`, `treasuryWithdrawals`, `noConfidence`, `updateCommittee`, `newConstitution`, `registerDrep`, `updateDrep`, `resignCommitteeCold`, `votingProcedures`).
- **Canonical `@context` URL constants** centralized in `src/core/default-contexts.ts` (`CIP100_CONTEXT_URL` … `CIP169_CONTEXT_URL`) — the URLs the `build` factories inject by default.
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
