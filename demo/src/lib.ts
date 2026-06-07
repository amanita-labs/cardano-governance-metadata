/**
 * Single import site for the library under test. Everything the demo uses from
 * `@amanita-labs/cardano-governance-metadata` is re-exported here so the rest
 * of the app imports from one place — and so it's obvious at a glance exactly
 * which public APIs the playground exercises.
 *
 * Only the library's *public* export surface (src/index.ts + the ./cipNNN
 * subpath exports) is used. Internal helpers (blake2b hashing, hex, raw
 * canonicalize) are not re-exported by the package and are intentionally not
 * reached into here.
 */

export {
  // Top-level pipeline + detection + fetching
  detectCipStandard,
  resolve,
  fetchMetadata,
  // CIP modules (each: parse / validate / verify / build)
  cip100,
  cip108,
  cip119,
  cip136,
  cip169,
  // Context resolution
  registerContext,
  unregisterContext,
  clearRegisteredContexts,
  listBundledContextUrls,
  createDocumentLoader,
  // COSE / CIP-8 witness inspection
  decodeCoseSign1,
  verifyCip8Witness,
} from "@amanita-labs/cardano-governance-metadata";

// Error types are re-exported type-only: the demo surfaces errors structurally
// (see IssueList) and never constructs or `instanceof`-checks them, so it must
// not depend on these runtime values surviving the library's tree-shaking.
export type {
  ErrorCode,
  GovernanceMetadataError,
  FetchError,
  ParseError,
  ValidationError,
  VerificationError,
} from "@amanita-labs/cardano-governance-metadata";

export type {
  OnChain,
  GovAction,
  Credential as Cip169Credential,
  CommitteeMember,
  Constitution,
  VotingProceduresNoAnchor,
} from "@amanita-labs/cardano-governance-metadata/cip169";

export type {
  CipStandard,
  Result,
  VerificationResult,
  WitnessVerificationResult,
  AnchorHashResult,
  ResolvedMetadata,
  ExtraFieldInfo,
  Author,
  Witness,
  ContextResolutionOptions,
  ReferenceType,
  HashedReference,
} from "@amanita-labs/cardano-governance-metadata";
