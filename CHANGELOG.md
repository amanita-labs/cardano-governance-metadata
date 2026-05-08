# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
