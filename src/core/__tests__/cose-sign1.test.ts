import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve as nodeResolve } from "node:path";
import * as ed from "@noble/ed25519";
import { encode } from "cbor2";
import { canonicalizeBody } from "../canonicalize.js";
import { decodeCoseSign1, verifyCip8Witness } from "../cose-sign1.js";
import { hashBlake2b256String } from "../hash.js";
import { bytesToHex, hexToBytes } from "../hex.js";

/**
 * Build a COSE_Sign1 hex string and sign it with @noble/ed25519. Mirrors
 * what a real wallet does when producing a CIP-8 witness.
 */
async function makeCoseSign1(args: {
	payload: Uint8Array;
	priv: Uint8Array;
	hashed?: boolean;
}): Promise<{ coseHex: string; pubHex: string }> {
	const pubBytes = await ed.getPublicKeyAsync(args.priv);

	// Protected header: alg = -8 (EdDSA). cbor2 encodes Map keys as integers
	// when given a Map.
	const protectedMap = new Map<number, number>();
	protectedMap.set(1, -8);
	const protectedBstr = encode(protectedMap);

	const unprotected: Record<string, boolean> = { hashed: args.hashed ?? false };

	// Sig_structure: ["Signature1", protected_bstr, h'', payload]
	const sigStructure = encode([
		"Signature1",
		protectedBstr,
		new Uint8Array(0),
		args.payload,
	]);
	const sigBytes = await ed.signAsync(sigStructure, args.priv);

	const cose = encode([protectedBstr, unprotected, args.payload, sigBytes]);
	return { coseHex: bytesToHex(cose), pubHex: bytesToHex(pubBytes) };
}

describe("decodeCoseSign1", () => {
	test("decodes a 4-element COSE_Sign1 array into its fields", async () => {
		const payload = new Uint8Array(32).fill(0xab);
		const { coseHex } = await makeCoseSign1({
			payload,
			priv: ed.utils.randomPrivateKey(),
		});
		const r = decodeCoseSign1(coseHex);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.cose.payload).toEqual(payload);
		expect(r.cose.signature.length).toBe(64);
		expect(r.cose.protectedBstr.length).toBeGreaterThan(0);
	});

	test("rejects malformed CBOR", () => {
		const r = decodeCoseSign1("deadbeef");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.reason).toMatch(/malformed CBOR/);
	});

	test("rejects non-array CBOR", () => {
		// CBOR byte string h'00': not an array
		const r = decodeCoseSign1("4100");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.reason).toMatch(/CBOR array/);
	});

	test("rejects wrong array arity", () => {
		// 3-element array of empty byte strings: 83 40 40 40
		const r = decodeCoseSign1("83404040");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.reason).toMatch(/4-element/);
	});

	test("rejects when protected header is not a byte string", () => {
		// 4-element array with a text string instead of bytes for protected_bstr
		// 84 60 a0 40 40  =>  array(4)[ tstr"", map{}, bstr"", bstr"" ]
		const r = decodeCoseSign1("8460a04040");
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.reason).toMatch(/protected header.*byte string/);
	});
});

describe("verifyCip8Witness", () => {
	test("round-trip: ed25519-signed COSE_Sign1 verifies against the same key", async () => {
		const priv = ed.utils.randomPrivateKey();
		const payload = new Uint8Array(32).fill(0xee);
		const { coseHex, pubHex } = await makeCoseSign1({ payload, priv });

		const r = await verifyCip8Witness(coseHex, payload, pubHex);
		expect(r.valid).toBe(true);
		expect(r.reason).toBeUndefined();
	});

	test("returns valid: false for a tampered inner signature", async () => {
		const priv = ed.utils.randomPrivateKey();
		const payload = new Uint8Array(32).fill(0xee);
		const { coseHex, pubHex } = await makeCoseSign1({ payload, priv });

		// Flip one nibble inside the inner signature region (last 64 bytes).
		const bytes = hexToBytes(coseHex);
		bytes[bytes.length - 1] ^= 0x01;
		const tamperedHex = bytesToHex(bytes);

		const r = await verifyCip8Witness(tamperedHex, payload, pubHex);
		expect(r.valid).toBe(false);
	});

	test("returns valid: false against a different public key", async () => {
		const priv = ed.utils.randomPrivateKey();
		const payload = new Uint8Array(32).fill(0xee);
		const { coseHex } = await makeCoseSign1({ payload, priv });

		const otherPub = bytesToHex(
			await ed.getPublicKeyAsync(ed.utils.randomPrivateKey()),
		);
		const r = await verifyCip8Witness(coseHex, payload, otherPub);
		expect(r.valid).toBe(false);
	});

	test("payload binding fails when expectedPayloadBytes differs", async () => {
		const priv = ed.utils.randomPrivateKey();
		const payload = new Uint8Array(32).fill(0xee);
		const { coseHex, pubHex } = await makeCoseSign1({ payload, priv });

		const wrongPayload = new Uint8Array(32).fill(0xff);
		const r = await verifyCip8Witness(coseHex, wrongPayload, pubHex);
		expect(r.valid).toBe(false);
		expect(r.reason).toMatch(/payload does not match/);
	});

	test("hashed=true mode is rejected with a diagnostic reason", async () => {
		const priv = ed.utils.randomPrivateKey();
		const payload = new Uint8Array(32).fill(0xee);
		const { coseHex, pubHex } = await makeCoseSign1({
			payload,
			priv,
			hashed: true,
		});

		const r = await verifyCip8Witness(coseHex, payload, pubHex);
		expect(r.valid).toBe(false);
		expect(r.reason).toMatch(/hashed payload mode.*not supported/);
	});

	test("malformed COSE hex yields valid: false (no throw)", async () => {
		const r = await verifyCip8Witness(
			"deadbeef",
			new Uint8Array(32),
			"00".repeat(32),
		);
		expect(r.valid).toBe(false);
		expect(r.reason).toMatch(/malformed CBOR|CBOR array/);
	});
});

// ─── Real-world interop ─────────────────────────────────────
// The strongest possible interop signal: a witness produced by EMURGO's real
// CIP-8 signing tool, against a real mainnet governance metadata document.
describe("verifyCip8Witness — real EMURGO mainnet fixture", () => {
	const fixtureDir = nodeResolve(
		import.meta.dir,
		"..",
		"..",
		"..",
		"docs",
		"examples",
		"fixtures",
		"governance-actions",
		"emurgo-sponsorship",
	);

	test("EMURGO's CIP-0008 witness on emurgo-sponsorship verifies", async () => {
		const doc = JSON.parse(
			readFileSync(`${fixtureDir}/metadata.jsonld`, "utf8"),
		) as { "@context": unknown; body: unknown; authors: unknown[] };
		const emurgo = doc.authors[1] as {
			witness: { signature: string; publicKey: string };
		};

		const canon = await canonicalizeBody(
			{ "@context": doc["@context"], body: doc.body },
			{ contextOptions: { policy: "bundled-only" } },
		);
		expect(canon.success).toBe(true);
		if (!canon.success) return;
		const bodyHash = hashBlake2b256String(canon.data);

		const r = await verifyCip8Witness(
			emurgo.witness.signature,
			hexToBytes(bodyHash),
			emurgo.witness.publicKey,
		);
		expect(r.valid).toBe(true);
	});
});
