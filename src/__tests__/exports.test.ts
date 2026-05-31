import { describe, expect, test } from "bun:test";
import * as root from "../index.js";

describe("public API surface (root entry)", () => {
	test("error classes are exported", () => {
		expect(typeof root.GovernanceMetadataError).toBe("function");
		expect(typeof root.FetchError).toBe("function");
		expect(typeof root.ParseError).toBe("function");
		expect(typeof root.ValidationError).toBe("function");
		expect(typeof root.VerificationError).toBe("function");
		expect(typeof root.ErrorCode).toBe("object");
	});

	test("ErrorCode contains the documented codes", () => {
		const codes = [
			"FETCH_FAILED",
			"FETCH_TIMEOUT",
			"INVALID_URI",
			"UNSUPPORTED_PROTOCOL",
			"INVALID_JSON",
			"INVALID_JSONLD",
			"MISSING_CONTEXT",
			"SCHEMA_VALIDATION_FAILED",
			"ANCHOR_HASH_MISMATCH",
			"CANONICALIZATION_FAILED",
			"SIGNATURE_INVALID",
			"ONCHAIN_MISMATCH",
			"CSL_NOT_INITIALIZED",
			"TX_DECODE_FAILED",
			"ONCHAIN_SELECTOR_AMBIGUOUS",
			"ONCHAIN_SELECTOR_NOT_FOUND",
			"UNKNOWN",
		];
		for (const code of codes) {
			expect(root.ErrorCode[code as keyof typeof root.ErrorCode]).toBe(
				code as never,
			);
		}
	});

	test("top-level functions are exported", () => {
		expect(typeof root.fetchMetadata).toBe("function");
		expect(typeof root.detectCipStandard).toBe("function");
		expect(typeof root.resolve).toBe("function");
	});

	test("context helpers are exported", () => {
		expect(typeof root.registerContext).toBe("function");
		expect(typeof root.unregisterContext).toBe("function");
		expect(typeof root.clearRegisteredContexts).toBe("function");
		expect(typeof root.listBundledContextUrls).toBe("function");
		expect(typeof root.createDocumentLoader).toBe("function");
	});

	test("each CIP namespace exports parse, validate, verify", () => {
		const names = ["cip100", "cip108", "cip119", "cip136"] as const;
		for (const name of names) {
			const ns = root[name] as Record<string, unknown>;
			expect(ns).toBeDefined();
			expect(typeof ns.parse).toBe("function");
			expect(typeof ns.validate).toBe("function");
			expect(typeof ns.verify).toBe("function");
		}
	});

	test("cip169 namespace exports its specialized functions", () => {
		expect(typeof root.cip169.parse).toBe("function");
		expect(typeof root.cip169.validate).toBe("function");
		expect(typeof root.cip169.stripSelfAnchor).toBe("function");
		expect(typeof root.cip169.compareOnChain).toBe("function");
		expect(typeof root.cip169.verifyAgainstTx).toBe("function");
		expect(typeof root.cip169.decodeConwayTx).toBe("function");
		expect(typeof root.cip169.setCardanoSerializationLib).toBe("function");
		expect(typeof root.cip169.getCardanoSerializationLib).toBe("function");
	});

	test("listBundledContextUrls returns the five known CIP context URLs", () => {
		const urls = root.listBundledContextUrls();
		expect(urls).toContain(
			"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld",
		);
		expect(urls).toContain(
			"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0108/cip-0108.common.jsonld",
		);
		expect(urls).toContain(
			"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0119/cip-0119.common.jsonld",
		);
		expect(urls).toContain(
			"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-0136.common.jsonld",
		);
		expect(urls).toContain(
			"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0169/cip-0169.common.jsonld",
		);
	});
});

describe("public API surface (subpath imports)", () => {
	test("cip100 subpath", async () => {
		const m = await import("../cip100/index.js");
		expect(typeof m.parse).toBe("function");
		expect(typeof m.validate).toBe("function");
		expect(typeof m.verify).toBe("function");
		expect(m.Cip100DocumentSchema).toBeDefined();
	});

	test("cip108 subpath", async () => {
		const m = await import("../cip108/index.js");
		expect(typeof m.parse).toBe("function");
		expect(typeof m.validate).toBe("function");
		expect(typeof m.verify).toBe("function");
		expect(m.Cip108DocumentSchema).toBeDefined();
	});

	test("cip119 subpath", async () => {
		const m = await import("../cip119/index.js");
		expect(typeof m.parse).toBe("function");
		expect(typeof m.validate).toBe("function");
		expect(typeof m.verify).toBe("function");
		expect(m.Cip119DocumentSchema).toBeDefined();
	});

	test("cip136 subpath", async () => {
		const m = await import("../cip136/index.js");
		expect(typeof m.parse).toBe("function");
		expect(typeof m.validate).toBe("function");
		expect(typeof m.verify).toBe("function");
		expect(m.Cip136DocumentSchema).toBeDefined();
	});

	test("cip169 subpath", async () => {
		const m = await import("../cip169/index.js");
		expect(typeof m.parse).toBe("function");
		expect(typeof m.validate).toBe("function");
		expect(typeof m.compareOnChain).toBe("function");
		expect(typeof m.verifyAgainstTx).toBe("function");
		expect(typeof m.decodeConwayTx).toBe("function");
		expect(typeof m.stripSelfAnchor).toBe("function");
		expect(typeof m.setCardanoSerializationLib).toBe("function");
		expect(m.OnChainSchema).toBeDefined();
	});
});
