import { describe, expect, test } from "bun:test";
import { hashBlake2b256, hashBlake2b256String } from "../hash.js";

describe("hashBlake2b256", () => {
	test("hashes the empty input to the known blake2b-256 vector", () => {
		expect(hashBlake2b256(new Uint8Array(0))).toBe(
			"0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8",
		);
	});

	test("hashes 'abc' to the known blake2b-256 vector", () => {
		// matches `python -c "import hashlib; print(hashlib.blake2b(b'abc', digest_size=32).hexdigest())"`
		expect(hashBlake2b256(new TextEncoder().encode("abc"))).toBe(
			"bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319",
		);
	});

	test("output is 64 hex characters (32 bytes)", () => {
		expect(hashBlake2b256(new Uint8Array([0x00])).length).toBe(64);
	});

	test("output is always lowercase hex", () => {
		expect(hashBlake2b256(new Uint8Array([0xff]))).toMatch(/^[0-9a-f]{64}$/);
	});

	test("different inputs produce different hashes", () => {
		const h1 = hashBlake2b256(new Uint8Array([0x00]));
		const h2 = hashBlake2b256(new Uint8Array([0x01]));
		expect(h1).not.toBe(h2);
	});

	test("identical inputs produce identical hashes (determinism)", () => {
		const input = new TextEncoder().encode("cardano");
		expect(hashBlake2b256(input)).toBe(hashBlake2b256(input));
	});
});

describe("hashBlake2b256String", () => {
	test("matches the bytes form for UTF-8 input", () => {
		const text = "abc";
		expect(hashBlake2b256String(text)).toBe(
			hashBlake2b256(new TextEncoder().encode(text)),
		);
	});

	test("empty string matches empty-bytes hash", () => {
		expect(hashBlake2b256String("")).toBe(hashBlake2b256(new Uint8Array(0)));
	});

	test("non-ASCII UTF-8 is encoded consistently", () => {
		const text = "Cardano à é î ō ū Ａ";
		expect(hashBlake2b256String(text)).toBe(
			hashBlake2b256(new TextEncoder().encode(text)),
		);
	});
});
