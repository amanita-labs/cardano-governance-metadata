// ─── Constants ──────────────────────────────────────────
export type HashAlgorithm = "blake2b-256";

export type WitnessAlgorithm = "ed25519";

export type CipStandard = "CIP-100" | "CIP-108" | "CIP-119" | "CIP-136";

// ─── Witness ────────────────────────────────────────────
export interface Witness {
  witnessAlgorithm: WitnessAlgorithm;
  publicKey: string;
  signature: string;
}

// ─── Author ─────────────────────────────────────────────
export interface Author {
  name?: string;
  witness?: Witness;
}

// ─── References ─────────────────────────────────────────
export type ReferenceType = "GovernanceMetadata" | "Other";

export interface Reference {
  "@type": ReferenceType;
  label: string;
  uri: string;
}

export interface ReferenceHash {
  hashDigest: string;
  hashAlgorithm: HashAlgorithm;
}

export interface HashedReference extends Reference {
  referenceHash?: ReferenceHash;
}

// ─── External Updates ───────────────────────────────────
export interface ExternalUpdate {
  title: string;
  uri: string;
}

// ─── JSON-LD Envelope ───────────────────────────────────
export interface JsonLdEnvelope {
  "@context": unknown;
  "@type"?: string;
  "@language"?: string;
}

// ─── Result ─────────────────────────────────────────────
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// ─── Parse Options ──────────────────────────────────────
export interface ParseOptions {
  skipValidation?: boolean;
}

// ─── Fetch Options ──────────────────────────────────────
export interface FetchOptions {
  fetch?: typeof globalThis.fetch;
  ipfsGateway?: string;
  arweaveGateway?: string;
  timeout?: number;
  signal?: AbortSignal;
}

// ─── Verification ───────────────────────────────────────
export interface AnchorHashResult {
  valid: boolean;
  expected: string;
  computed: string;
}

export interface WitnessVerificationResult {
  authorIndex: number;
  authorName?: string;
  publicKey: string;
  signatureValid: boolean;
}

export interface VerificationResult {
  anchorHash?: AnchorHashResult;
  witnesses: WitnessVerificationResult[];
  valid: boolean;
}

export type VerifyInput =
  | { rawBytes: Uint8Array }
  | { uri: string }
  | { document: Record<string, unknown>; rawBytes?: Uint8Array };

export interface VerifyOptions {
  anchorHash?: string;
  fetchOptions?: FetchOptions;
  skipWitnessVerification?: boolean;
}

// ─── Resolve ────────────────────────────────────────────
export interface ResolvedMetadata {
  cipStandard: CipStandard;
  document: Record<string, unknown>;
  rawBytes: Uint8Array;
  extraFields: ExtraFieldInfo[];
  verification?: VerificationResult;
}

export interface ExtraFieldInfo {
  path: string;
  value: unknown;
}

export interface ResolveOptions {
  anchorHash?: string;
  fetchOptions?: FetchOptions;
  skipVerification?: boolean;
}
