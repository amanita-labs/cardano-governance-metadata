import { describe, expect, test } from "bun:test";
import * as ed from "@noble/ed25519";
import { canonicalizeBody } from "../../core/canonicalize.js";
import {
	type GovernanceMetadataError,
	ParseError,
	ValidationError,
} from "../../core/errors.js";
import { hashBlake2b256String } from "../../core/hash.js";
import { bytesToHex } from "../../core/hex.js";
import type {
	Result,
	VerificationResult,
	VerifyInput,
	VerifyOptions,
} from "../../core/types.js";

/**
 * Adapter shape implemented by every CIP-XXX module
 * (cip100, cip108, cip119, cip136). Lets us run a shared test battery
 * over all four with one helper.
 *
 * Each per-CIP module returns its own document type (Cip100Document, etc.) —
 * we only assert structural shape in tests, so we accept any object via
 * `unknown`.
 */
export interface CipModuleAdapter {
	parse: (
		input: string | Record<string, unknown>,
	) => Result<unknown, ParseError | ValidationError>;
	validate: (input: unknown) => Result<unknown, ValidationError>;
	verify: (
		input: VerifyInput,
		options?: VerifyOptions,
	) => Promise<Result<VerificationResult, GovernanceMetadataError>>;
}

/**
 * Sign the canonicalized form of `document` and return a copy with
 * one author whose witness is a valid ed25519 signature over the
 * canonicalized N-Quads. Uses bundled-only contexts so this is hermetic.
 */
export async function signDocument<T extends Record<string, unknown>>(
	document: T,
): Promise<{ signed: T; publicKey: string; privateKey: Uint8Array }> {
	const priv = ed.utils.randomPrivateKey();
	const pubBytes = await ed.getPublicKeyAsync(priv);
	const publicKey = bytesToHex(pubBytes);

	// Sign over the body envelope (matches CIP-100 / verify.ts).
	const docAsRec = document as unknown as Record<string, unknown>;
	const bodyEnvelope = {
		"@context": docAsRec["@context"],
		body: docAsRec.body,
	};
	const canon = await canonicalizeBody(bodyEnvelope, {
		contextOptions: { policy: "bundled-only" },
	});
	if (!canon.success) {
		throw new Error(`Failed to canonicalize fixture: ${canon.error.message}`);
	}
	const bodyHash = hashBlake2b256String(canon.data);
	const sigBytes = await ed.signAsync(bodyHash, priv);
	const signature = bytesToHex(sigBytes);

	const existingAuthors = (document.authors as unknown[] | undefined) ?? [];
	const signed = {
		...document,
		authors: [
			...existingAuthors,
			{
				name: "test-author",
				witness: {
					witnessAlgorithm: "ed25519",
					publicKey,
					signature,
				},
			},
		],
	} as T;

	return { signed, publicKey, privateKey: priv };
}

export interface CipSuiteFixtures {
	validDocument: Record<string, unknown>;
	/** A version of validDocument with a deliberately broken required field. */
	invalidDocument: Record<string, unknown>;
}

/**
 * Run the standard parse/validate/verify battery against a CIP module.
 * Tests are added under the caller's `describe()` block.
 */
export function runCipSuite(
	cipName: string,
	adapter: CipModuleAdapter,
	fixtures: CipSuiteFixtures,
): void {
	describe(`${cipName} parse`, () => {
		test("accepts a valid document object", () => {
			const r = adapter.parse(fixtures.validDocument);
			expect(r.success).toBe(true);
		});

		test("accepts a valid document JSON string", () => {
			const r = adapter.parse(JSON.stringify(fixtures.validDocument));
			expect(r.success).toBe(true);
		});

		test("returns ParseError on malformed JSON", () => {
			const r = adapter.parse("{not json");
			expect(r.success).toBe(false);
			if (!r.success) {
				expect(r.error).toBeInstanceOf(ParseError);
			}
		});

		test("returns ValidationError on schema violation", () => {
			const r = adapter.parse(fixtures.invalidDocument);
			expect(r.success).toBe(false);
			if (!r.success) {
				expect(r.error).toBeInstanceOf(ValidationError);
			}
		});

		test("preserves unknown extra fields (passthrough)", () => {
			const docWithExtra = {
				...fixtures.validDocument,
				myCustomField: "custom-value",
			};
			const r = adapter.parse(docWithExtra);
			expect(r.success).toBe(true);
			if (r.success) {
				expect((r.data as Record<string, unknown>).myCustomField).toBe(
					"custom-value",
				);
			}
		});
	});

	describe(`${cipName} validate`, () => {
		test("accepts a valid document", () => {
			const r = adapter.validate(fixtures.validDocument);
			expect(r.success).toBe(true);
		});

		test("returns ValidationError with structured issues on bad input", () => {
			const r = adapter.validate(fixtures.invalidDocument);
			expect(r.success).toBe(false);
			if (!r.success) {
				expect(r.error).toBeInstanceOf(ValidationError);
				expect(r.error.issues.length).toBeGreaterThan(0);
				for (const issue of r.error.issues) {
					expect(typeof issue.path).toBe("string");
					expect(typeof issue.message).toBe("string");
				}
			}
		});

		test("rejects an unknown hashAlgorithm", () => {
			const broken = JSON.parse(JSON.stringify(fixtures.validDocument));
			broken.hashAlgorithm = "sha256";
			const r = adapter.validate(broken);
			expect(r.success).toBe(false);
		});
	});

	describe(`${cipName} verify`, () => {
		test("verifies a document with a valid ed25519 witness", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			const r = await adapter.verify(
				{ document: signed },
				{ contextOptions: { policy: "bundled-only" } },
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.valid).toBe(true);
			expect(r.data.witnesses.length).toBe(1);
			expect(r.data.witnesses[0].signatureValid).toBe(true);
		});

		test("reports signatureValid=false for a tampered witness", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			const tampered = JSON.parse(JSON.stringify(signed)) as typeof signed;
			// Flip one nibble in the signature
			const witness = (
				tampered.authors as Array<{ witness: { signature: string } }>
			)[0].witness;
			const sig = witness.signature;
			witness.signature =
				(Number.parseInt(sig.slice(0, 2), 16) ^ 0x1)
					.toString(16)
					.padStart(2, "0") + sig.slice(2);

			const r = await adapter.verify(
				{ document: tampered },
				{ contextOptions: { policy: "bundled-only" } },
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.valid).toBe(false);
			expect(r.data.witnesses[0].signatureValid).toBe(false);
		});

		test("documents with no authors verify vacuously", async () => {
			const noAuthors = { ...fixtures.validDocument, authors: [] };
			const r = await adapter.verify(
				{ document: noAuthors },
				{ contextOptions: { policy: "bundled-only" } },
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.valid).toBe(true);
			expect(r.data.witnesses).toEqual([]);
		});

		test("anchor hash check passes for matching expected hash", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			const rawBytes = new TextEncoder().encode(JSON.stringify(signed));
			const { hashBlake2b256 } = await import("../../core/hash.js");
			const expectedHash = hashBlake2b256(rawBytes);

			const r = await adapter.verify(
				{ document: signed, rawBytes },
				{
					anchorHash: expectedHash,
					contextOptions: { policy: "bundled-only" },
				},
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.anchorHash?.valid).toBe(true);
			expect(r.data.valid).toBe(true);
		});

		test("anchor hash check fails for mismatched expected hash", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			const rawBytes = new TextEncoder().encode(JSON.stringify(signed));

			const r = await adapter.verify(
				{ document: signed, rawBytes },
				{
					anchorHash: "00".repeat(32),
					contextOptions: { policy: "bundled-only" },
				},
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.anchorHash?.valid).toBe(false);
			expect(r.data.valid).toBe(false);
		});

		test("skipWitnessVerification short-circuits signature check", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			// Tamper anyway — but skip should bypass it
			const tampered = JSON.parse(JSON.stringify(signed)) as typeof signed;
			(
				tampered.authors as Array<{ witness: { signature: string } }>
			)[0].witness.signature = "00".repeat(64);

			const r = await adapter.verify(
				{ document: tampered },
				{
					skipWitnessVerification: true,
					contextOptions: { policy: "bundled-only" },
				},
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.witnesses).toEqual([]);
			expect(r.data.valid).toBe(true);
		});

		test("rawBytes input path parses + verifies", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			const rawBytes = new TextEncoder().encode(JSON.stringify(signed));

			const r = await adapter.verify(
				{ rawBytes },
				{ contextOptions: { policy: "bundled-only" } },
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.valid).toBe(true);
		});

		test("uri input path fetches + verifies via mocked fetch", async () => {
			const { signed } = await signDocument(fixtures.validDocument);
			const rawBytes = new TextEncoder().encode(JSON.stringify(signed));
			const mockFetch = (async () =>
				new Response(new Blob([rawBytes as unknown as BlobPart]), {
					status: 200,
					headers: { "content-type": "application/json" },
				})) as unknown as typeof fetch;

			const r = await adapter.verify(
				{ uri: "https://example.com/doc.jsonld" },
				{
					contextOptions: { policy: "bundled-only" },
					fetchOptions: { fetch: mockFetch },
				},
			);
			expect(r.success).toBe(true);
			if (!r.success) return;
			expect(r.data.valid).toBe(true);
		});
	});
}
