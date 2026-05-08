export type {
  HashAlgorithm,
  WitnessAlgorithm,
  CipStandard,
  CipExtension,
  Witness,
  Author,
  ReferenceType,
  Reference,
  ReferenceHash,
  HashedReference,
  ExternalUpdate,
  JsonLdEnvelope,
  Result,
  ParseOptions,
  FetchOptions,
  AnchorHashResult,
  WitnessVerificationResult,
  VerificationResult,
  VerifyInput,
  VerifyOptions,
  ResolvedMetadata,
  ExtraFieldInfo,
  ResolveOptions,
  ContextPolicy,
  ContextResolutionOptions,
  RemoteContextDocument,
} from "./core/types.js";

export {
  ErrorCode,
  GovernanceMetadataError,
  FetchError,
  ParseError,
  ValidationError,
  VerificationError,
} from "./core/errors.js";

export * as cip100 from "./cip100/index.js";
export * as cip108 from "./cip108/index.js";
export * as cip119 from "./cip119/index.js";
export * as cip136 from "./cip136/index.js";
export * as cip169 from "./cip169/index.js";

export { fetchMetadata } from "./core/fetcher.js";
export { detectCipStandard } from "./detect.js";
export { resolve } from "./resolve.js";
export {
  registerContext,
  unregisterContext,
  clearRegisteredContexts,
  listBundledContextUrls,
  createDocumentLoader,
  type DocumentLoader,
  type DocumentLoaderFn,
} from "./core/context.js";
