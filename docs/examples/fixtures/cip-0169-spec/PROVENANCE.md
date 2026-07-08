# CIP-0169 spec fixtures — provenance

These files are vendored **byte-identical** from the CIP-0169 specification
("Governance Metadata - On-Chain Binding"):

- Repository: https://github.com/Ryun1/CIPs
- Branch: `cip-governance-metadata-extension`
- Commit: `8046c792b26f59cc08b4f6843ab6f8bf4b1ad5fe`
- Directory: `CIP-0169/`
- CIP PR: https://github.com/cardano-foundation/CIPs/pull/1101

Contents:

- `examples/*.jsonld` — the spec's 9 valid example documents
- `examples/invalid/forbidden-anchor.jsonld` — negative vector #1 (must FAIL validation)
- `examples/preview/` — live Preview-testnet documents with their cardano-cli
  text envelopes (`.action` / `.vote` / `.cert`) and human-readable `.json` views
- `cip-0169.common.schema.json` — the spec's JSON Schema (draft 2020-12)
- `cip-0169.common.jsonld` — the spec's JSON-LD `@context` fragment
- `test-vector.md` — golden file-content hashes, canonicalized body hashes,
  author keys/signatures, and negative vectors

Do NOT reformat or edit these files: the file-content hashes in
`test-vector.md` are computed over their exact bytes and are asserted by
`src/__tests__/cip169-spec-conformance.test.ts`.

To refresh after a spec update, re-copy from the source commit and update the
commit hash above.
