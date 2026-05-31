# Examples

Each script is self-contained and runnable with Bun directly:

```sh
bun run docs/examples/<filename>.ts
```

## Getting started

| Script | What it shows | Network? |
|---|---|---|
| [`detect-and-parse.ts`](./detect-and-parse.ts) | `detectCipStandard` + per-CIP parse with typed schema | No |
| [`resolve.ts`](./resolve.ts) | One-shot fetch → detect → parse → validate → verify pipeline | Yes (IPFS) |

## Per-CIP validation

| Script | What it shows | Network? |
|---|---|---|
| [`validate-cip108.ts`](./validate-cip108.ts) | Governance action document, including title length constraint | No |
| [`validate-cip119.ts`](./validate-cip119.ts) | DRep registration document | No |
| [`validate-cip136.ts`](./validate-cip136.ts) | Constitutional Committee vote with `internalVote` | No |

## Verification

| Script | What it shows | Network? | CSL? |
|---|---|---|---|
| [`verify-signatures.ts`](./verify-signatures.ts) | Anchor hash + ed25519 witness signatures over canonicalized body | Yes | No |
| [`cip169-verify-tx.ts`](./cip169-verify-tx.ts) | Compare a metadata document's `body.onChain` against a real Conway transaction CBOR | No | **Yes** |
| [`cip169-compare.ts`](./cip169-compare.ts) | Diff two `onChain` values directly (no transaction needed) | No | No |

## Advanced

| Script | What it shows | Network? |
|---|---|---|
| [`fetch-ipfs.ts`](./fetch-ipfs.ts) | Custom IPFS / Arweave gateways and timeouts | Yes |
| [`context-allowlist.ts`](./context-allowlist.ts) | Resolve unbundled JSON-LD `@context` URLs via allowlist or registerContext | No |
| [`extra-fields.ts`](./extra-fields.ts) | How `resolve` flags fields not defined by the detected CIP | No |
| [`error-handling.ts`](./error-handling.ts) | Pattern-match on `Result.success === false` and `ErrorCode` | No |

## Notes

- **CSL?** column refers to the Cardano Serialization Library
  (`@emurgo/cardano-serialization-lib-nodejs`). Only CIP-169 transaction
  decoding needs it, and you must register it once via
  `cip169.setCardanoSerializationLib(CSL)` before using `decodeConwayTx` or
  `verifyAgainstTx`.
- **Network?** Examples marked Yes require IPFS / Arweave / HTTPS reachability.
  Use `verify: false` and bundled-only contexts to run hermetically.
- The `fixtures/` directory holds JSON-LD test documents shared by examples
  and by the resolve tests in `src/__tests__/`.
