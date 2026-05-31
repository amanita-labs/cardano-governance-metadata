import { canonicalizeBody } from "../core/canonicalize.js";
import { verifyCip8Witness } from "../core/cose-sign1.js";
import {
	ErrorCode,
	type GovernanceMetadataError,
	ParseError,
} from "../core/errors.js";
import { fetchMetadata } from "../core/fetcher.js";
import { hashBlake2b256 } from "../core/hash.js";
import { hashBlake2b256String } from "../core/hash.js";
import { hexToBytes } from "../core/hex.js";
import type {
	Result,
	VerificationResult,
	VerifyInput,
	VerifyOptions,
	WitnessVerificationResult,
} from "../core/types.js";
import { verifyEd25519Signature } from "../core/verify-signature.js";
import { parse } from "./parse.js";
import type { Cip100Document } from "./types.js";

/**
 * Verify a CIP-100 governance metadata document end-to-end:
 *
 * 1. Resolve `input` to raw bytes (fetching if a URI was given) and a
 *    parsed document.
 * 2. If `options.anchorHash` is set, compare it against
 *    `blake2b256(rawBytes)` and report the result on `data.anchorHash`.
 * 3. For each `author.witness` in the document, canonicalize
 *    `{ "@context", body }` to N-Quads (URDNA2015), hash the canonical form
 *    with blake2b-256, then verify the ed25519 signature over that hash.
 *
 * `data.valid` is `true` iff every per-witness `signatureValid` is `true` and
 * the anchor hash check (if any) passed. Documents with no witnesses verify
 * vacuously.
 *
 * Pass `options.skipWitnessVerification = true` when you only care about the
 * anchor hash, or `options.contextOptions` to pin context resolution.
 */
export async function verify(
	input: VerifyInput,
	options?: VerifyOptions,
): Promise<Result<VerificationResult, GovernanceMetadataError>> {
	let rawBytes: Uint8Array | undefined;
	let document: Record<string, unknown>;

	// Step 1: Resolve input to raw bytes and/or parsed document
	if ("uri" in input) {
		const fetchResult = await fetchMetadata(input.uri, options?.fetchOptions);
		if (!fetchResult.success) return fetchResult;
		rawBytes = fetchResult.data;
	} else if ("rawBytes" in input) {
		rawBytes = input.rawBytes;
	} else {
		document = input.document;
		rawBytes = input.rawBytes;
	}

	// Step 2: Parse if we only have raw bytes
	if (!("document" in input) || !input.document) {
		if (!rawBytes) {
			return {
				success: false,
				error: new ParseError(ErrorCode.INVALID_JSON, "No input provided"),
			};
		}
		const text = new TextDecoder().decode(rawBytes);
		const parseResult = parse(text);
		if (!parseResult.success) return parseResult;
		document = parseResult.data as unknown as Record<string, unknown>;
	} else {
		document = input.document;
	}

	// Step 3: Check anchor hash if provided
	let anchorHash: VerificationResult["anchorHash"];
	if (options?.anchorHash) {
		const expectedLower = options.anchorHash.toLowerCase();
		if (rawBytes) {
			const computed = hashBlake2b256(rawBytes);
			anchorHash = {
				valid: computed === expectedLower,
				expected: expectedLower,
				computed,
			};
		} else {
			// Caller asked for an anchor-hash check but only supplied a
			// pre-parsed document — anchor hash is defined over the raw
			// serialized bytes, so we cannot recompute. Refuse to silently
			// pass; surface as a structural failure.
			anchorHash = {
				valid: false,
				expected: expectedLower,
				reason:
					"anchorHash check requested but no rawBytes available — pass `rawBytes` (or `uri`) instead of just `document` to enable this check",
			};
		}
	}

	// Step 4: Verify witness signatures
	const witnesses: WitnessVerificationResult[] = [];

	if (!options?.skipWitnessVerification) {
		const doc = document as unknown as Cip100Document;
		const authors = doc.authors ?? [];
		const hasWitnesses = authors.some(
			(a) => a.witness?.publicKey && a.witness?.signature,
		);

		// Per CIP-100, witnesses sign the canonicalized form of the document body
		// (with the envelope's @context attached so JSON-LD has term mappings).
		// Authors / hashAlgorithm / other envelope fields are NOT covered.
		const bodyEnvelope: Record<string, unknown> = {
			"@context": (document as { "@context": unknown })["@context"],
			body: (document as { body: unknown }).body,
		};

		// Canonicalize once — the input is identical for every witness, so
		// recomputing per author would do N URDNA2015 runs (and N JSON-LD
		// document-loader rebuilds) instead of 1. Skip entirely when there are
		// no witnesses to verify.
		let bodyHash: string | undefined;
		if (hasWitnesses) {
			const canonResult = await canonicalizeBody(bodyEnvelope, {
				contextOptions: options?.contextOptions,
			});
			if (!canonResult.success) return canonResult;
			bodyHash = hashBlake2b256String(canonResult.data);
		}

		for (let i = 0; i < authors.length; i++) {
			const author = authors[i];
			if (!author.witness?.publicKey || !author.witness?.signature) continue;
			// hasWitnesses === true means bodyHash is set.
			const messageHash = bodyHash as string;

			const algorithm = author.witness.witnessAlgorithm;
			let signatureValid: boolean;
			let unsupportedReason: string | undefined;

			if (algorithm === "ed25519") {
				signatureValid = await verifyEd25519Signature(
					author.witness.signature,
					messageHash,
					author.witness.publicKey,
				);
			} else if (algorithm === "CIP-8" || algorithm === "CIP-0008") {
				// CIP-8 / CIP-0008: the witness's `signature` is a full COSE_Sign1
				// envelope (CIP-8 Cardano Message Signing). verifyCip8Witness
				// decodes it, binds payload === blake2b256(canonical body), and
				// verifies the inner ed25519 signature.
				const r = await verifyCip8Witness(
					author.witness.signature,
					hexToBytes(messageHash),
					author.witness.publicKey,
				);
				signatureValid = r.valid;
				unsupportedReason = r.reason;
			} else {
				signatureValid = false;
				unsupportedReason = `unknown witnessAlgorithm: ${String(algorithm)}`;
			}

			witnesses.push({
				authorIndex: i,
				authorName: author.name,
				publicKey: author.witness.publicKey,
				witnessAlgorithm: algorithm,
				signatureValid,
				...(unsupportedReason ? { unsupportedReason } : {}),
			});
		}
	}

	const valid =
		(anchorHash?.valid ?? true) && witnesses.every((w) => w.signatureValid);

	return {
		success: true,
		data: { anchorHash, witnesses, valid },
	};
}
