/**
 * Minimal COSE_Sign1 verifier for CIP-8 (Cardano Message Signing) witnesses.
 *
 * CIP-100 metadata documents may carry witnesses with `witnessAlgorithm:
 * "ed25519"` (raw signature over the body hash) or `"CIP-8"` / `"CIP-0008"`
 * (a COSE_Sign1 envelope from RFC 8152). This module handles the latter.
 *
 * The COSE_Sign1 wire format is a 4-element CBOR array:
 *   [protected_bstr, unprotected_map, payload, signature]
 *
 * Verification:
 *   1. CBOR-decode the witness's `signature` field.
 *   2. Confirm the structure is COSE_Sign1 (array of 4, with byte-typed members).
 *   3. Bind the payload to the document: `payload === blake2b256(canonical body)`.
 *      Without this, an attacker could COSE-sign different content and paste
 *      the result into a witness — the inner ed25519 signature would still
 *      verify cryptographically but would not attest to the metadata.
 *   4. Reconstruct the Sig_structure per CIP-8:
 *        ["Signature1", protected_bstr, h'', payload]
 *      and verify the inner ed25519 signature against the witness's public key.
 *
 * v1 only supports `unprotected.hashed = false` (the common case in
 * production). `hashed: true` returns `valid: false` + a diagnostic
 * `unsupportedReason`; signature verification is never attempted in that
 * case (default-deny).
 */
import { decode, encode } from "cbor2";
import { bytesToHex, hexToBytes } from "./hex.js";
import { verifyEd25519Signature } from "./verify-signature.js";

interface DecodedCoseSign1 {
	protectedBstr: Uint8Array;
	/** Either a plain object (string keys) or a Map (numeric/binary keys). */
	unprotectedMap: Record<string, unknown> | Map<unknown, unknown>;
	payload: Uint8Array;
	signature: Uint8Array;
}

type DecodeResult =
	| { ok: true; cose: DecodedCoseSign1 }
	| { ok: false; reason: string };

function isUint8Array(value: unknown): value is Uint8Array {
	return value instanceof Uint8Array;
}

/**
 * CBOR-decode a COSE_Sign1 hex string. Returns the four wire-level fields,
 * leaving the `protected_bstr` opaque (callers MUST NOT re-decode it before
 * reconstructing the Sig_structure — the signed bytes are the encoded form,
 * not the abstract map).
 */
export function decodeCoseSign1(coseHex: string): DecodeResult {
	let coseBytes: Uint8Array;
	try {
		coseBytes = hexToBytes(coseHex);
	} catch (err) {
		return {
			ok: false,
			reason: `malformed COSE_Sign1 hex: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	let decoded: unknown;
	try {
		decoded = decode(coseBytes);
	} catch (err) {
		return {
			ok: false,
			reason: `malformed CBOR: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	if (!Array.isArray(decoded)) {
		return { ok: false, reason: "expected COSE_Sign1 (CBOR array)" };
	}
	if (decoded.length !== 4) {
		return {
			ok: false,
			reason: `expected COSE_Sign1 (4-element array); got ${decoded.length}-element`,
		};
	}

	const [protectedBstr, unprotectedRaw, payload, signature] = decoded;

	if (!isUint8Array(protectedBstr)) {
		return { ok: false, reason: "protected header must be a byte string" };
	}
	if (!isUint8Array(payload)) {
		return { ok: false, reason: "payload must be a byte string" };
	}
	if (!isUint8Array(signature)) {
		return { ok: false, reason: "signature must be a byte string" };
	}

	const unprotectedMap =
		unprotectedRaw instanceof Map
			? unprotectedRaw
			: typeof unprotectedRaw === "object" && unprotectedRaw !== null
				? (unprotectedRaw as Record<string, unknown>)
				: {};

	return {
		ok: true,
		cose: { protectedBstr, unprotectedMap, payload, signature },
	};
}

function readUnprotected(
	map: Record<string, unknown> | Map<unknown, unknown>,
	key: string,
): unknown {
	if (map instanceof Map) {
		return map.get(key);
	}
	return map[key];
}

// COSE label constants (RFC 8152 §3.1).
const COSE_LABEL_ALG = 1;
const COSE_LABEL_KID = 4;
const COSE_ALG_EDDSA = -8;

interface ProtectedHeader {
	alg?: number;
	kid?: Uint8Array;
}

/**
 * CBOR-decode the protected header bstr. Returns `null` (header absent) when
 * the bstr is empty — RFC 8152 §3 permits an empty protected_bstr for
 * messages with no protected parameters.
 *
 * Reads only `alg` (label 1, int) and `kid` (label 4, bstr); other parameters
 * are ignored. Returns a string reason on malformed input.
 */
function decodeProtectedHeader(
	protectedBstr: Uint8Array,
):
	| { ok: true; header: ProtectedHeader | null }
	| { ok: false; reason: string } {
	if (protectedBstr.length === 0) {
		return { ok: true, header: null };
	}
	let decoded: unknown;
	try {
		decoded = decode(protectedBstr);
	} catch (err) {
		return {
			ok: false,
			reason: `malformed COSE protected header: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	const map =
		decoded instanceof Map
			? decoded
			: typeof decoded === "object" && decoded !== null
				? new Map(Object.entries(decoded as Record<string, unknown>))
				: null;
	if (!map) {
		return {
			ok: false,
			reason: "COSE protected header must decode to a CBOR map",
		};
	}

	const header: ProtectedHeader = {};

	const algRaw = map.get(COSE_LABEL_ALG);
	if (algRaw !== undefined) {
		if (typeof algRaw !== "number" || !Number.isInteger(algRaw)) {
			return {
				ok: false,
				reason: `COSE protected.alg must be an integer; got ${typeof algRaw}`,
			};
		}
		header.alg = algRaw;
	}

	const kidRaw = map.get(COSE_LABEL_KID);
	if (kidRaw !== undefined) {
		if (!isUint8Array(kidRaw)) {
			return {
				ok: false,
				reason: "COSE protected.kid must be a byte string",
			};
		}
		header.kid = kidRaw;
	}

	return { ok: true, header };
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

export interface VerifyCip8Result {
	valid: boolean;
	/**
	 * Diagnostic on `valid: false` due to a structural reason (malformed
	 * envelope, unsupported payload mode). Absent for cryptographic mismatches.
	 */
	reason?: string;
}

/**
 * Verify a CIP-8 / COSE_Sign1 witness from a CIP-100 governance metadata
 * document.
 *
 * @param coseHex             The witness's `signature` field (the entire
 *                            COSE_Sign1 hex, not just the inner ed25519 sig).
 * @param expectedPayloadBytes The bytes the payload is expected to bind to —
 *                            for CIP-100 witnesses this is
 *                            `hexToBytes(blake2b256(canonical body))`.
 * @param publicKeyHex        The witness's ed25519 public key (32 bytes /
 *                            64 hex chars).
 * @returns `{ valid }` (always set) plus an optional diagnostic `reason`.
 *          Never throws — malformed inputs become `valid: false`.
 *
 * @example
 * const r = await verifyCip8Witness(witness.signature, hexToBytes(bodyHash), witness.publicKey);
 * if (!r.valid) console.log(r.reason ?? "signature does not verify");
 */
export async function verifyCip8Witness(
	coseHex: string,
	expectedPayloadBytes: Uint8Array,
	publicKeyHex: string,
): Promise<VerifyCip8Result> {
	const decoded = decodeCoseSign1(coseHex);
	if (!decoded.ok) {
		return { valid: false, reason: decoded.reason };
	}

	const { protectedBstr, unprotectedMap, payload, signature } = decoded.cose;

	const hashed = readUnprotected(unprotectedMap, "hashed");
	if (hashed === true) {
		return {
			valid: false,
			reason:
				"hashed payload mode (CIP-8 unprotected.hashed=true) is not supported in v1",
		};
	}

	// Algorithm + key-id binding (defense-in-depth — the inner ed25519 check
	// is still authoritative). If the protected header declares alg, it MUST
	// be -8 (EdDSA); if it declares kid, it MUST equal the supplied publicKey
	// bytes — anything else is an alg- or key-confusion signal.
	const headerResult = decodeProtectedHeader(protectedBstr);
	if (!headerResult.ok) {
		return { valid: false, reason: headerResult.reason };
	}
	const header = headerResult.header;
	if (header?.alg !== undefined && header.alg !== COSE_ALG_EDDSA) {
		return {
			valid: false,
			reason: `COSE protected.alg ${header.alg} does not match expected EdDSA (-8)`,
		};
	}
	if (header?.kid !== undefined) {
		let publicKeyBytes: Uint8Array;
		try {
			publicKeyBytes = hexToBytes(publicKeyHex);
		} catch (err) {
			return {
				valid: false,
				reason: `publicKey is not valid hex: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
		if (!bytesEqual(header.kid, publicKeyBytes)) {
			return {
				valid: false,
				reason: `COSE protected.kid does not match publicKey (kid=${bytesToHex(header.kid)}, publicKey=${publicKeyHex})`,
			};
		}
	}

	// Binding check: the COSE payload must equal the canonical body hash.
	if (!bytesEqual(payload, expectedPayloadBytes)) {
		return {
			valid: false,
			reason: `COSE payload does not match expected body hash (got ${bytesToHex(
				payload,
			)}, expected ${bytesToHex(expectedPayloadBytes)})`,
		};
	}

	// Sig_structure per RFC 8152 / CIP-8: ["Signature1", body_protected, external_aad, payload]
	let sigStructureBytes: Uint8Array;
	try {
		sigStructureBytes = encode([
			"Signature1",
			protectedBstr,
			new Uint8Array(0),
			payload,
		]);
	} catch (err) {
		return {
			valid: false,
			reason: `failed to encode Sig_structure: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	const ok = await verifyEd25519Signature(
		signature,
		sigStructureBytes,
		publicKeyHex,
	);
	return { valid: ok };
}
