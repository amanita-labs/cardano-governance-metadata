// ─── Constants ──────────────────────────────────────────
export type HashAlgorithm = "blake2b-256";

export type WitnessAlgorithm = "ed25519" | "CIP-8" | "CIP-0008";

export type CipStandard = "CIP-100" | "CIP-108" | "CIP-119" | "CIP-136";

export type CipExtension = "CIP-169";

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
	/**
	 * Present when raw bytes were available to hash. Always lowercase hex.
	 * `expected` is also lowercased before comparison (so an uppercase
	 * caller-supplied hash still matches a byte-equal computed value).
	 */
	computed?: string;
	/**
	 * Populated when `valid: false` is structural (e.g. the caller asked for
	 * an anchorHash check but no rawBytes were available), as opposed to a
	 * byte-mismatch. Absent on a clean equality failure.
	 */
	reason?: string;
}

export interface WitnessVerificationResult {
	authorIndex: number;
	authorName?: string;
	publicKey: string;
	witnessAlgorithm: WitnessAlgorithm;
	signatureValid: boolean;
	/**
	 * Diagnostic-only: populated when the signature could not be verified for
	 * a structural reason (malformed COSE envelope, unsupported payload mode,
	 * etc.) rather than a cryptographic mismatch. `signatureValid` remains
	 * `false` regardless — this is the security-critical flag.
	 */
	unsupportedReason?: string;
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
	contextOptions?: ContextResolutionOptions;
}

// ─── Context resolution ─────────────────────────────────
export type ContextPolicy = "bundled-only" | "allowlist" | "fetch";

export interface ContextResolutionOptions {
	policy?: ContextPolicy;
	allowlist?: (string | RegExp)[];
	overrides?: Record<string, object>;
	cache?: Map<string, RemoteContextDocument>;
	fetch?: typeof globalThis.fetch;
}

export interface RemoteContextDocument {
	contextUrl: string | undefined;
	documentUrl: string;
	document: unknown;
}

// ─── Resolve ────────────────────────────────────────────
export interface ResolvedMetadata {
	cipStandard: CipStandard;
	extensions: CipExtension[];
	document: Record<string, unknown>;
	rawBytes: Uint8Array;
	extraFields: ExtraFieldInfo[];
	/**
	 * Anchor hash + per-witness signature results. Omitted when
	 * `skipVerification: true` AND when `verificationError` is set —
	 * `verification` and `verificationError` are mutually exclusive.
	 */
	verification?: VerificationResult;
	/**
	 * Set when verification was attempted but failed structurally (e.g.
	 * canonicalization could not resolve a JSON-LD @context, a witness
	 * signature could not be decoded). Distinct from `verification.valid:
	 * false`, which means verification ran and at least one check failed.
	 *
	 * Callers gating trust on signatures should treat
	 * `verificationError !== undefined` as "could not verify", not as
	 * "verification skipped".
	 */
	verificationError?: GovernanceMetadataErrorLike;
}

/**
 * Structural mirror of `GovernanceMetadataError` exposed on
 * `ResolvedMetadata.verificationError` so consumers can branch on `code`
 * without needing to `instanceof` against the error classes.
 */
export interface GovernanceMetadataErrorLike {
	name: string;
	code: string;
	message: string;
}

export interface ExtraFieldInfo {
	path: string;
	value: unknown;
}

export interface ResolveOptions {
	anchorHash?: string;
	fetchOptions?: FetchOptions;
	skipVerification?: boolean;
	contextOptions?: ContextResolutionOptions;
}
