# @amanita-labs/cardano-governance-metadata

TypeScript library for fetching, parsing, validating, and verifying Cardano governance metadata.

Supports [CIP-100](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0100) and its extensions:

| Standard | Description | Spec |
|----------|-------------|------|
| CIP-100 | Governance Metadata (base) | [cardano-foundation/CIPs/CIP-0100](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0100) |
| CIP-108 | Governance Actions | [cardano-foundation/CIPs/CIP-0108](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0108) |
| CIP-119 | DRep Registration | [cardano-foundation/CIPs/CIP-0119](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0119) |
| CIP-136 | Constitutional Committee Votes | [cardano-foundation/CIPs/CIP-0136](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0136) |
| CIP-169 | On-Chain Effects (cross-cutting; layered on any of the above) | [cardano-foundation/CIPs#1101 (draft)](https://github.com/cardano-foundation/CIPs/pull/1101) |

> CIP-169 is in draft until PR [#1101](https://github.com/cardano-foundation/CIPs/pull/1101) is merged. Pin a specific version of this library if you depend on a specific draft revision.

See also: [`docs/architecture.md`](./docs/architecture.md) for design notes, [`docs/examples/`](./docs/examples/) for runnable examples, and [`CHANGELOG.md`](./CHANGELOG.md) for release notes.

## Install

```bash
bun add @amanita-labs/cardano-governance-metadata
```

## Quick Start

### Resolve metadata from a URI

Given any governance metadata URI, `resolve()` will fetch it, detect which CIP standard it conforms to, validate it, verify signatures, and report any extra fields:

```typescript
import { resolve } from "@amanita-labs/cardano-governance-metadata";

const result = await resolve(
  "ipfs://QmExampleCid",
  { anchorHash: "7b7d4a28..." },  // optional on-chain anchor hash
);

if (result.success) {
  const { cipStandard, document, extraFields, verification } = result.data;

  console.log(`Detected: ${cipStandard}`);  // "CIP-119"
  console.log(`Document:`, document);
  console.log(`Anchor hash valid:`, verification?.anchorHash?.valid);
  console.log(`Signatures valid:`, verification?.valid);

  // Extra fields not defined by the detected CIP are preserved and reported
  if (extraFields.length > 0) {
    console.warn("Unknown fields found:");
    for (const field of extraFields) {
      console.warn(`  ${field.path}:`, field.value);
    }
  }
}
```

### Parse a governance metadata document

```typescript
import { cip100, detectCipStandard } from "@amanita-labs/cardano-governance-metadata";

const json = `{
  "@context": { ... },
  "hashAlgorithm": "blake2b-256",
  "authors": [],
  "body": {
    "comment": "I support this proposal because..."
  }
}`;

const result = cip100.parse(json);

if (result.success) {
  console.log(result.data.body.comment);
} else {
  console.error(result.error.message);
}
```

### Detect which CIP standard a document uses

```typescript
import { detectCipStandard, cip108, cip119, cip136 } from "@amanita-labs/cardano-governance-metadata";

const doc = JSON.parse(rawJson);
const standard = detectCipStandard(doc);

switch (standard) {
  case "CIP-108": {
    const result = cip108.parse(doc);
    if (result.success) {
      console.log(result.data.body.title);
      console.log(result.data.body.abstract);
    }
    break;
  }
  case "CIP-119": {
    const result = cip119.parse(doc);
    if (result.success) {
      console.log(result.data.body.givenName);
      console.log(result.data.body.objectives);
    }
    break;
  }
  case "CIP-136": {
    const result = cip136.parse(doc);
    if (result.success) {
      console.log(result.data.body.summary);
      console.log(result.data.body.rationaleStatement);
    }
    break;
  }
}
```

### Validate a DRep registration (CIP-119)

```typescript
import { cip119 } from "@amanita-labs/cardano-governance-metadata";

const result = cip119.validate({
  "@context": { /* ... */ },
  hashAlgorithm: "blake2b-256",
  body: {
    givenName: "Ada Lovelace",
    objectives: "Improve on-chain governance tooling",
    motivations: "Passionate about decentralized decision-making",
    qualifications: "5 years in Cardano development",
    paymentAddress: "addr1q...",
    references: [
      { "@type": "Link", label: "Twitter", uri: "https://twitter.com/example" },
    ],
  },
});

if (!result.success) {
  for (const issue of result.error.issues) {
    console.error(`${issue.path}: ${issue.message}`);
  }
}
```

### Validate a governance action (CIP-108)

```typescript
import { cip108 } from "@amanita-labs/cardano-governance-metadata";

const result = cip108.validate({
  "@context": { /* ... */ },
  hashAlgorithm: "blake2b-256",
  body: {
    title: "Increase K parameter to 100,000",  // max 80 chars
    abstract: "This proposal aims to...",        // max 2500 chars
    motivation: "The current K parameter...",
    rationale: "By increasing K we achieve...",
  },
});

if (result.success) {
  console.log("Valid governance action metadata");
}
```

### Fetch and verify metadata from a URI

```typescript
import { cip100 } from "@amanita-labs/cardano-governance-metadata";

// Verify against an on-chain anchor hash
const result = await cip100.verify(
  { uri: "https://example.com/metadata.jsonld" },
  { anchorHash: "7b7d4a28a599bbb8c08b239be2645fa82d63a848320bf4760b07d86fcf1aabdc" },
);

if (result.success) {
  const { anchorHash, witnesses, valid } = result.data;

  console.log("Overall valid:", valid);
  console.log("Anchor hash match:", anchorHash?.valid);

  for (const w of witnesses) {
    console.log(`Author ${w.authorName}: signature ${w.signatureValid ? "valid" : "INVALID"}`);
  }
}
```

### Fetch from IPFS or Arweave

```typescript
import { fetchMetadata } from "@amanita-labs/cardano-governance-metadata";

// IPFS
const ipfsResult = await fetchMetadata("ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco");

// Arweave
const arResult = await fetchMetadata("ar://some-tx-id");

// Custom IPFS gateway
const customResult = await fetchMetadata("ipfs://QmXyz...", {
  ipfsGateway: "https://gateway.pinata.cloud/ipfs/{cid}",
});

if (ipfsResult.success) {
  const text = new TextDecoder().decode(ipfsResult.data);
  const parsed = cip100.parse(text);
}
```

### Verify a CC vote rationale (CIP-136)

```typescript
import { cip136 } from "@amanita-labs/cardano-governance-metadata";

const result = cip136.parse({
  "@context": { /* ... */ },
  hashAlgorithm: "blake2b-256",
  authors: [{ name: "CC Member", witness: { /* ... */ } }],
  body: {
    summary: "Constitutional - aligns with Article 3, Section 5",
    rationaleStatement: "After thorough review, this governance action...",
    precedentDiscussion: "Similar proposals in the past have...",
    conclusion: "We vote Yes on constitutional grounds.",
    internalVote: {
      constitutional: 5,
      unconstitutional: 1,
      abstain: 1,
    },
    references: [
      { "@type": "RelevantArticles", label: "Article 3", uri: "https://..." },
    ],
  },
});

if (result.success) {
  const { internalVote } = result.data.body;
  console.log(`Vote: ${internalVote?.constitutional} for, ${internalVote?.unconstitutional} against`);
}
```

### CIP-169: bind metadata to its on-chain effect

CIP-169 introduces an optional `body.onChain` property that cryptographically binds metadata to the exact `ProposalProcedure` / `VotingProcedure` / DRep cert it describes — closing metadata-replay and multi-author-misattachment gaps. The library decodes Conway transactions itself (via the Cardano Serialization Library) and self-verifies the binding.

#### Setup: register a CSL build (one-time)

```typescript
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { cip169 } from "@amanita-labs/cardano-governance-metadata";

// Pick the CSL build that matches your environment:
//   @emurgo/cardano-serialization-lib-nodejs   (Node)
//   @emurgo/cardano-serialization-lib-browser  (Browser)
//   @emurgo/cardano-serialization-lib-asmjs    (universal, slower)
//   @dcspark/cardano-multiplatform-lib-*        (CML — also accepted via duck-typing)
cip169.setCardanoSerializationLib(CSL);
```

#### 1. Diff two metadata documents (no transaction needed)

`compareOnChain` strips self-referential anchors per spec, then deep-equals the two onChain values:

```typescript
const draftProposal = {
  deposit: "100000000000",
  reward_account: "stake1u...",
  gov_action: { tag: "treasury_withdrawals_action", rewards: [/* ... */] },
};
const submittedProposal = { ...draftProposal, anchor: { /* self-anchor — stripped */ } };

const r = cip169.compareOnChain(draftProposal, submittedProposal);
if (r.success && r.data.equal) console.log("identical");
else if (r.success) console.error("differences:", r.data.differences);
```

See the runnable example: [`docs/examples/cip169-compare.ts`](./docs/examples/cip169-compare.ts).

#### 2. Verify against a single-action Conway transaction

```typescript
const v = await cip169.verifyAgainstTx(metadataDocument, txCborHex);
if (v.success && v.data.matched) {
  console.log("matched:", v.data.selectorUsed);
} else if (v.success) {
  console.error("mismatch at:", v.data.differences);
}
```

See the runnable example: [`docs/examples/cip169-verify-tx.ts`](./docs/examples/cip169-verify-tx.ts).

#### 3. Multi-action transactions: select which item to verify against

When a tx carries multiple proposals/certs/voting procedures, pass a `selector`:

```typescript
const v = await cip169.verifyAgainstTx(metadataDocument, txCborHex, {
  selector: { kind: "proposalProcedure", index: 1 },  // 0-based
});
// kinds: "proposalProcedure" | "certificate" | "votingProcedures"
// Without index, the library errors with ONCHAIN_SELECTOR_AMBIGUOUS if more
// than one candidate of the chosen kind exists.
```

`verifyAgainstTx` decodes only the three transaction-body fields CIP-169 binds (`certs`, `voting_procedures`, `voting_proposals`). Self-referential anchors are stripped per spec.

The lower-level `cip169.compareOnChain(metadataOnChain, alreadyDecodedAction)` and `cip169.decodeConwayTx(txBytes)` are also exported for callers who need to drive each step themselves.

### Resolving JSON-LD `@context` URIs

Many real metadata documents ship `@context` as a single URI string instead of an inlined object — for example, the CIP-169 PR examples use:

```json
"@context": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0169/cip-0169.common.jsonld"
```

The library bundles every CIP context (CIP-100/108/119/136/169) under both `raw.githubusercontent.com/...` and `github.com/.../blob/...` URLs and resolves them offline during canonicalization.

By default, an unknown `@context` URI errors with `MISSING_CONTEXT` rather than silently fetching it (which would make signature verification non-reproducible). To allow other URIs, pass `contextOptions`:

```typescript
import { resolve, registerContext } from "@amanita-labs/cardano-governance-metadata";

// Option 1: register a context up front (e.g. an Intersect-MBO-hosted schema)
registerContext(
  "https://intersectmbo.github.io/governance-actions/v1.1.0/schemas/hard-fork-initiation/common.jsonld",
  await loadLocalJsonld(),
);

// Option 2: per-call allowlist (globs supported)
const r = await resolve("ipfs://...", {
  contextOptions: {
    policy: "allowlist",
    allowlist: ["https://intersectmbo.github.io/governance-actions/v*/**"],
    overrides: { /* exact-URL → context object */ },
  },
});

// Option 3: opt into network fetches (caches results)
await resolve("ipfs://...", { contextOptions: { policy: "fetch" } });
```

## Subpath Imports

Import only the CIP module you need for smaller bundles:

```typescript
import { parse, validate, verify } from "@amanita-labs/cardano-governance-metadata/cip119";
import type { Cip119Document } from "@amanita-labs/cardano-governance-metadata/cip119";
```

Available subpaths: `/cip100`, `/cip108`, `/cip119`, `/cip136`, `/cip169`

## API

Every CIP module exports the same three functions:

### `parse(input, options?)`

Parse a JSON string or object into a typed document with schema validation.

```typescript
parse(input: string | object, options?: { skipValidation?: boolean }): Result<CipDocument>
```

### `validate(document)`

Validate an unknown object against the CIP schema. Returns typed data on success or validation issues on failure.

```typescript
validate(document: unknown): Result<CipDocument>
```

### `verify(input, options?)`

Full verification pipeline: fetch, anchor hash check, JSON-LD canonicalization, and ed25519 signature verification.

```typescript
verify(
  input: { uri: string } | { rawBytes: Uint8Array } | { document: object },
  options?: {
    anchorHash?: string;          // on-chain anchor hash to verify against
    skipWitnessVerification?: boolean;
    fetchOptions?: FetchOptions;
  },
): Promise<Result<VerificationResult>>
```

### `resolve(uri, options?)`

All-in-one: fetch metadata from a URI, detect the CIP standard, validate, and verify signatures. Extra fields not defined by the detected CIP are preserved in the document and listed separately in `extraFields`.

```typescript
resolve(
  uri: string,
  options?: {
    anchorHash?: string;
    skipVerification?: boolean;
    fetchOptions?: FetchOptions;
  },
): Promise<Result<ResolvedMetadata>>
```

```typescript
interface ResolvedMetadata {
  cipStandard: "CIP-100" | "CIP-108" | "CIP-119" | "CIP-136";
  extensions: ("CIP-169")[];           // cross-cutting extensions detected on the body
  document: Record<string, unknown>;   // full document with extra fields preserved
  rawBytes: Uint8Array;
  extraFields: ExtraFieldInfo[];       // fields not defined by the detected CIP
  verification?: VerificationResult;   // anchor hash + signature results
}
```

### `detectCipStandard(document)`

Detect which CIP standard a document conforms to based on its body fields.

```typescript
detectCipStandard(document: object): "CIP-100" | "CIP-108" | "CIP-119" | "CIP-136" | null
```

### `fetchMetadata(uri, options?)`

Fetch raw metadata bytes from HTTPS, IPFS, or Arweave URIs.

```typescript
fetchMetadata(uri: string, options?: FetchOptions): Promise<Result<Uint8Array>>
```

## Result Type

All functions return a discriminated union instead of throwing:

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

## Error Handling

Errors include a machine-readable `code` for programmatic matching:

```typescript
import { ErrorCode } from "@amanita-labs/cardano-governance-metadata";

const result = cip108.parse(input);
if (!result.success) {
  switch (result.error.code) {
    case ErrorCode.INVALID_JSON:
      // malformed JSON
      break;
    case ErrorCode.SCHEMA_VALIDATION_FAILED:
      // schema validation failed - check result.error.issues
      break;
  }
}
```

## Troubleshooting

**`CSL_NOT_INITIALIZED`** — A CIP-169 function tried to decode a transaction but no CSL build was registered. Install one of the CSL flavors as a peer dependency and call `cip169.setCardanoSerializationLib(CSL)` once at startup.

**`MISSING_CONTEXT`** when canonicalizing — The document's JSON-LD `@context` URL is neither bundled nor matched by your `contextOptions`. Either register the context up front (`registerContext(url, doc)`), allowlist it (`contextOptions.allowlist`), or — only if you trust the source — set `contextOptions.policy = "fetch"`. The library refuses to fetch unknown contexts by default because doing so would make signature verification non-reproducible.

**`FETCH_TIMEOUT`** / `FETCH_FAILED` — The fetcher hit its timeout (default 30s) or got a non-2xx response. Override with `fetchOptions: { timeout, fetch, ipfsGateway, arweaveGateway, signal }`.

**`ANCHOR_HASH_MISMATCH`** — The blake2b-256 hash of the raw fetched bytes did not match the `anchorHash` you supplied. Common causes: the publisher hashed the document *before* canonicalization; the gateway returned different bytes (e.g. trailing whitespace from a CDN); the on-chain hash was registered against a different version. The anchor hash is over **raw bytes** of the metadata file, not over the canonicalized form.

**Witness `signatureValid: false`** — The author's signature did not match the canonical body hash. Per CIP-100 the signature is over `blake2b256(canonicalize({"@context": ..., body}))`. For `witnessAlgorithm: "ed25519"`, the hex of that hash is what's signed. For `"CIP-8"` / `"CIP-0008"` (COSE_Sign1 envelope), the library decodes the envelope, binds `payload === blake2b256(canonical body)`, then verifies the inner ed25519 signature over the Sig_structure. The signing tool must use the same `@context` mapping the verifier uses. Check `result.witnesses[i].unsupportedReason` for diagnostics on structural failures (malformed CBOR, `hashed: true` payload mode, etc.).

## License

Apache-2.0
