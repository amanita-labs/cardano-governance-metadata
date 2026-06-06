# Architecture

A short tour of how the library is put together and why. Useful before extending it or wiring it into a larger system.

## The pipeline

Most calls go through the same five stages:

```
URI ──► fetch ──► parse ──► detect ──► validate ──► verify
        bytes    JSON      CIP        zod schema   anchor + signatures
```

`resolve(uri, options)` runs the whole pipeline. Each stage is also exported individually:

| Stage | Public symbol | File |
|---|---|---|
| Fetch | `fetchMetadata` | [`src/core/fetcher.ts`](../src/core/fetcher.ts) |
| Parse | `cipNNN.parse` | `src/cipNNN/parse.ts` |
| Detect | `detectCipStandard` | [`src/detect.ts`](../src/detect.ts) |
| Validate | `cipNNN.validate` | `src/cipNNN/validate.ts` |
| Verify | `cipNNN.verify` | `src/cipNNN/verify.ts` |
| All-in-one | `resolve` | [`src/resolve.ts`](../src/resolve.ts) |

### Building documents (the inverse of parse)

Each CIP module also exports `build` ([`src/cipNNN/build.ts`](../src)) — the construction-side counterpart to `parse`. It assembles the JSON-LD envelope around a caller-supplied `body`, injecting the canonical `@context` URL (from [`src/core/default-contexts.ts`](../src/core/default-contexts.ts)) and the `hashAlgorithm: "blake2b-256"` default, then runs the result through the *same* Zod schema `validate` uses. This guarantees `build → parse` round-trips and keeps the construction path from drifting from the validation path. Witness signing is deliberately out of scope: `build` only assembles structure, so it has no dependency on canonicalization or CSL.

CIP-169's `build` is shaped differently — it validates a bare `OnChain` payload (proposal procedure / certificate / voting procedures) rather than a full envelope, because CIP-169 nests inside another CIP's `body.onChain`. The companion [`src/cip169/actions.ts`](../src/cip169/actions.ts) provides pure type-narrowed constructors for each Conway `gov_action` / certificate / voter shape — no runtime validation of their own; the assembled payload is validated end-to-end by `build`.

## Design choices

### Result types instead of throwing

Every public function returns a discriminated union:

```ts
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

Why: governance metadata is processed in batch (think: validating every DRep's metadata, or every proposal in an epoch). Throwing on the first malformed input would force every caller to wrap each call in `try/catch`. With `Result`, a batch validator just filters on `.success === false` and surfaces a structured error report.

The internal `verify` does still propagate fetch/parse failures — it returns `{ success: false, error }` if upstream stages failed.

### JSON-LD canonicalization (URDNA2015)

CIP-100 anchor hashes and witness signatures are computed over the **canonicalized N-Quads** form of the document body, not over its raw bytes. This means two documents that differ only in whitespace or key ordering produce the same hash.

The canonicalize step is at [`src/core/canonicalize.ts`](../src/core/canonicalize.ts) and uses the [`jsonld`](https://github.com/digitalbazaar/jsonld.js) library's URDNA2015 implementation.

**Subtlety:** witnesses sign `{ "@context": ..., body }` — only the envelope's `@context` plus the `body` field. Authors and `hashAlgorithm` are NOT covered by the witness signature. This matches the CIP-100 spec and prevents the chicken-and-egg problem of signing a document that contains your own signature. See [`src/cip100/verify.ts`](../src/cip100/verify.ts).

The canonicalizer runs with a strict event handler: any body field not mapped by the `@context` triggers `CANONICALIZATION_FAILED`. The default `safe: true` is too aggressive because the published CIP-100/108/119/136 contexts do not declare every `@type` value (`"Other"`, `"Link"`, ...) as a term, so it emits "relative @type reference" warnings that don't represent data loss. The custom handler accepts those cosmetic warnings but rejects every data-loss event (`invalid property`, `free-floating scalar`, `null @id/@value`, etc.) — closing the signature-confusion gap that `safe: false` left open (an attacker could otherwise append an unmapped body field that jsonld dropped from the canonical form but that `resolve().data.document.body.X` would still surface to the caller). Schemas continue to `passthrough()` unknown fields so `resolve()` can report them via `extraFields`; they just can't be silently signed-over.

### Bundled JSON-LD contexts

The five canonical CIP contexts are bundled into the package at build time as JSON imports (`with { type: "json" }`). The default policy is `"allowlist"` with no patterns, which means **unknown `@context` URIs error rather than fetch silently** — fetching unknown contexts would make signature verification non-reproducible against future CIP revisions.

To allow other contexts, callers explicitly opt in via:
- `registerContext(url, document)` — bake a context in at startup,
- `contextOptions.allowlist: ["https://example.com/v*/**"]` — glob/regex match for runtime fetches,
- `contextOptions.overrides: { url: doc }` — exact-URL injection per call,
- `contextOptions.policy: "fetch"` — escape hatch to allow any URL.

See [`src/core/context.ts`](../src/core/context.ts).

### CIP-8 / COSE_Sign1 witnesses

CIP-100 documents may carry witnesses with `witnessAlgorithm: "ed25519"` (raw ed25519 over the body hash) or `"CIP-8"` / `"CIP-0008"` (a COSE_Sign1 envelope from CIP-8 Cardano Message Signing). EMURGO's witnesses on Intersect treasury proposals use the latter; multi-author governance documents typically have at least one CIP-8 witness.

The library implements COSE_Sign1 verification directly on top of [`cbor2`](https://www.npmjs.com/package/cbor2) (~111 KB) rather than depending on EMURGO's `@emurgo/cardano-message-signing-*` peer dep. The verifier:

1. CBOR-decodes the witness's `signature` field — a 4-element array `[protected_bstr, unprotected_map, payload, signature]`.
2. **Binds payload to document**: requires `payload === blake2b256(canonical body)` bytes. Without this, an attacker could COSE-sign different content and paste it as a witness.
3. Reconstructs the Sig_structure (`["Signature1", protected_bstr, h'', payload]`) and verifies the inner ed25519 signature against the witness's stated `publicKey`.

The COSE_Sign1 spec is small and we only consume (never produce) — owning ~100 LOC of decoder lets us avoid forcing consumers into either a CMS peer-dep dance or a 4 MB asmjs install. Implementation lives in [`src/core/cose-sign1.ts`](../src/core/cose-sign1.ts) and is wired into [`src/cip100/verify.ts`](../src/cip100/verify.ts) via algorithm dispatch.

v1 supports `unprotected.hashed = false` (every observed real-world fixture). `hashed = true` returns `signatureValid: false` with an `unsupportedReason` on the result; defense-in-depth `address` derivation against `publicKey` is a deliberate follow-up.

### CSL as a peer dependency

CIP-169 verification requires decoding Conway-era transactions. The library does this through the [Cardano Serialization Library](https://github.com/Emurgo/cardano-serialization-lib), but doesn't depend on a specific build — `nodejs`, `browser`, `asmjs`, or even the [Cardano Multiplatform Library](https://github.com/dcSpark/cardano-multiplatform-lib) (CML) all work. Users register their preferred build once via `cip169.setCardanoSerializationLib(CSL)`, and the library uses structural duck-typing internally.

This avoids forcing a binding choice on consumers (binary size, native vs WASM trade-offs) and keeps the package ergonomic for tooling that already imports CSL elsewhere. The CSL adapter lives in [`src/cip169/conway/csl-loader.ts`](../src/cip169/conway/csl-loader.ts).

## CIP-169 specifics

Three exports do most of the work:

- **[`stripSelfAnchor`](../src/cip169/strip-self-anchor.ts)** removes the self-referential anchor fields that Cardano transactions carry on `ProposalProcedure`, certificates, and `VotingProcedure`. These anchors point back at the metadata that's being compared, so leaving them in would create a chicken-and-egg problem at comparison time. `Constitution.anchor` on `new_constitution` actions is preserved because that anchor points at the constitution document, not at the metadata describing the action.

- **[`compareOnChain`](../src/cip169/compare.ts)** strips self-anchors from both sides, then deep-equals. On mismatch it returns a structured `differences[]` array with paths (`gov_action.rewards[0].key`) and both values. This is the comparator you use when both sides are already in CIP-0116 JSON shape.

- **[`verifyAgainstTx`](../src/cip169/compare.ts)** is `decodeConwayTx` + `compareOnChain` glued together. It decodes a Conway tx, finds the bound item the metadata refers to (using a `selector` to disambiguate when multiple are present), and runs `compareOnChain`. Returns `matched: true` with the resolved selector, or `matched: false` with a diff.

## Layering

```
                                     ┌──── (cross-cutting: any of below + body.onChain) ────┐
                            CIP-169  │                                                       │
                                     │                                                       │
                            CIP-108  │  CIP-119          CIP-136                             │
                            (action) │  (DRep reg)       (CC vote)                           │
                                     │     │                │                                │
                                     └──── ▼ ──── ▼ ─────── ▼ ────────────────────────────── ┘
                                              CIP-100
                                       (envelope, witnesses)
```

CIP-108/119/136 each extend the CIP-100 envelope with their own `body` shape. Their `verify()` functions delegate to `cip100.verify` because the verification semantics (anchor hash + canonicalize body + check witnesses) are identical — only the schema differs.

CIP-169 layers orthogonally: any of the four base CIPs can carry a `body.onChain` field. `detectCipStandard` is unchanged by CIP-169; the cross-cutting `extensions: ["CIP-169"]` array on `ResolvedMetadata` reports whether the body has an `onChain` block.

## Where to look next

- Tests under `src/**/__tests__/` exercise every public path; they're a good map of the API surface.
- [`docs/examples/`](./examples/) has runnable end-to-end scripts for each stage.
- [`CHANGELOG.md`](../CHANGELOG.md) tracks behavior-affecting changes.
