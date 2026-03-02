# cardano-governance-metadata

TypeScript library for fetching, parsing, validating, and verifying Cardano governance metadata.

Supports [CIP-100](https://github.com/cardano-foundation/CIPs/tree/master/CIP-0100) and its extensions:

| Standard | Description |
|----------|-------------|
| CIP-100 | Governance Metadata (base) |
| CIP-108 | Governance Actions |
| CIP-119 | DRep Registration |
| CIP-136 | Constitutional Committee Votes |

## Install

```bash
bun add cardano-governance-metadata
```

## Quick Start

### Resolve metadata from a URI

Given any governance metadata URI, `resolve()` will fetch it, detect which CIP standard it conforms to, validate it, verify signatures, and report any extra fields:

```typescript
import { resolve } from "cardano-governance-metadata";

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
import { cip100, detectCipStandard } from "cardano-governance-metadata";

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
import { detectCipStandard, cip108, cip119, cip136 } from "cardano-governance-metadata";

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
import { cip119 } from "cardano-governance-metadata";

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
import { cip108 } from "cardano-governance-metadata";

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
import { cip100 } from "cardano-governance-metadata";

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
import { fetchMetadata } from "cardano-governance-metadata";

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
import { cip136 } from "cardano-governance-metadata";

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

## Subpath Imports

Import only the CIP module you need for smaller bundles:

```typescript
import { parse, validate, verify } from "cardano-governance-metadata/cip119";
import type { Cip119Document } from "cardano-governance-metadata/cip119";
```

Available subpaths: `/cip100`, `/cip108`, `/cip119`, `/cip136`

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
import { ErrorCode } from "cardano-governance-metadata";

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

## License

Apache-2.0
