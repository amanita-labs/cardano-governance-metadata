import { describe, expect, test } from "bun:test";
import { canonicalizeBody } from "../canonicalize.js";
import { createDocumentLoader } from "../context.js";
import { ErrorCode } from "../errors.js";

const CIP100_CTX =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld";

describe("canonicalizeBody", () => {
	test("produces non-empty N-Quads for a minimal CIP-100 document", async () => {
		const doc = {
			"@context": CIP100_CTX,
			hashAlgorithm: "blake2b-256",
			body: {
				comment: "hello",
			},
		};
		const r = await canonicalizeBody(doc, {
			contextOptions: { policy: "bundled-only" },
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.length).toBeGreaterThan(0);
		expect(r.data.endsWith("\n")).toBe(true);
	});

	test("is deterministic across multiple runs", async () => {
		const doc = {
			"@context": CIP100_CTX,
			hashAlgorithm: "blake2b-256",
			body: { comment: "stable" },
		};
		const opts = { contextOptions: { policy: "bundled-only" as const } };
		const a = await canonicalizeBody(doc, opts);
		const b = await canonicalizeBody(doc, opts);
		expect(a.success).toBe(true);
		expect(b.success).toBe(true);
		if (a.success && b.success) {
			expect(a.data).toBe(b.data);
		}
	});

	test("output is independent of input key order", async () => {
		const optsA = { contextOptions: { policy: "bundled-only" as const } };
		const docA = {
			"@context": CIP100_CTX,
			hashAlgorithm: "blake2b-256",
			body: { comment: "abc", references: [] },
		};
		const docB = {
			body: { references: [], comment: "abc" },
			hashAlgorithm: "blake2b-256",
			"@context": CIP100_CTX,
		};
		const a = await canonicalizeBody(docA, optsA);
		const b = await canonicalizeBody(docB, optsA);
		expect(a.success).toBe(true);
		expect(b.success).toBe(true);
		if (a.success && b.success) {
			expect(a.data).toBe(b.data);
		}
	});

	test("accepts a precomputed documentLoader", async () => {
		const loader = createDocumentLoader({ policy: "bundled-only" });
		const doc = {
			"@context": CIP100_CTX,
			hashAlgorithm: "blake2b-256",
			body: { comment: "hi" },
		};
		const r = await canonicalizeBody(doc, { documentLoader: loader });
		expect(r.success).toBe(true);
	});

	test("returns CANONICALIZATION_FAILED on invalid JSON-LD", async () => {
		// @context that loader cannot resolve under bundled-only policy
		const doc = {
			"@context": "https://does-not-exist.example/ctx.jsonld",
			hashAlgorithm: "blake2b-256",
			body: { comment: "x" },
		};
		const r = await canonicalizeBody(doc, {
			contextOptions: { policy: "bundled-only" },
		});
		expect(r.success).toBe(false);
		if (!r.success) {
			expect(r.error.code).toBe(ErrorCode.CANONICALIZATION_FAILED);
		}
	});
});
