import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve as nodeResolve } from "node:path";
import { ErrorCode, detectCipStandard, resolve } from "../index.js";

const FIXTURE_DIR = nodeResolve(
	import.meta.dir,
	"..",
	"..",
	"docs",
	"examples",
	"fixtures",
	"cip-0169",
);

function loadFixtureBytes(name: string): Uint8Array {
	return new Uint8Array(readFileSync(`${FIXTURE_DIR}/${name}`));
}

function makeFetchFor(bytes: Uint8Array): typeof fetch {
	return (async () =>
		new Response(new Blob([bytes as unknown as BlobPart]), {
			status: 200,
			headers: { "content-type": "application/json" },
		})) as unknown as typeof fetch;
}

describe("resolve + detect on CIP-0169 fixtures", () => {
	test("treasury-withdrawal: detects CIP-108, extensions includes CIP-169", async () => {
		const bytes = loadFixtureBytes("treasury-withdrawal.jsonld");
		const r = await resolve("https://fixture/treasury-withdrawal.jsonld", {
			skipVerification: true,
			fetchOptions: { fetch: makeFetchFor(bytes) },
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.cipStandard).toBe("CIP-108");
		expect(r.data.extensions).toContain("CIP-169");
		expect(r.data.extraFields).toEqual([]);
	});

	test("parameter-change: detects CIP-108, extensions includes CIP-169", async () => {
		const bytes = loadFixtureBytes("parameter-change.jsonld");
		const r = await resolve("https://fixture/parameter-change.jsonld", {
			skipVerification: true,
			fetchOptions: { fetch: makeFetchFor(bytes) },
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.cipStandard).toBe("CIP-108");
		expect(r.data.extensions).toContain("CIP-169");
	});

	test("vote: detects CIP-100 fallback, extensions still includes CIP-169", async () => {
		const bytes = loadFixtureBytes("vote.jsonld");
		const r = await resolve("https://fixture/vote.jsonld", {
			skipVerification: true,
			fetchOptions: { fetch: makeFetchFor(bytes) },
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.cipStandard).toBe("CIP-100");
		expect(r.data.extensions).toContain("CIP-169");
	});

	test("detectCipStandard alone is unchanged: still ignores onChain", () => {
		const doc = JSON.parse(
			new TextDecoder().decode(loadFixtureBytes("treasury-withdrawal.jsonld")),
		);
		expect(detectCipStandard(doc)).toBe("CIP-108");
	});
});

describe("resolve — additional coverage", () => {
	test("invalid JSON returned by fetcher surfaces as ParseError(INVALID_JSON)", async () => {
		const r = await resolve("https://fixture/bad.jsonld", {
			fetchOptions: {
				fetch: (async () =>
					new Response("not json", { status: 200 })) as unknown as typeof fetch,
			},
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.INVALID_JSON);
	});

	test("undetectable document body returns INVALID_JSONLD", async () => {
		// detectCipStandard requires `body` to be present; without it, detection fails.
		const bytes = new TextEncoder().encode(
			JSON.stringify({
				"@context": "https://example.com/x",
				hashAlgorithm: "blake2b-256",
			}),
		);
		const r = await resolve("https://fixture/empty.jsonld", {
			fetchOptions: {
				fetch: (async () =>
					new Response(new Blob([bytes as unknown as BlobPart]), {
						status: 200,
					})) as unknown as typeof fetch,
			},
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.INVALID_JSONLD);
	});

	test("CIP-119 path parses + extraFields are flagged for unknown body fields", async () => {
		const doc = {
			"@context":
				"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0119/cip-0119.common.jsonld",
			hashAlgorithm: "blake2b-256",
			body: {
				givenName: "Alice DRep",
				someUnknownField: "preserved",
			},
			myCustomTopLevel: "also preserved",
		};
		const bytes = new TextEncoder().encode(JSON.stringify(doc));
		const r = await resolve("https://fixture/drep.jsonld", {
			skipVerification: true,
			fetchOptions: {
				fetch: (async () =>
					new Response(new Blob([bytes as unknown as BlobPart]), {
						status: 200,
					})) as unknown as typeof fetch,
			},
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.cipStandard).toBe("CIP-119");
		expect(
			r.data.extraFields.some((f) => f.path === "body.someUnknownField"),
		).toBe(true);
		expect(r.data.extraFields.some((f) => f.path === "myCustomTopLevel")).toBe(
			true,
		);
	});

	test("CIP-136 path parses", async () => {
		const doc = {
			"@context":
				"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-0136.common.jsonld",
			hashAlgorithm: "blake2b-256",
			body: {
				summary: "Vote NO on action.",
				rationaleStatement: "After review, we cannot support this action.",
			},
		};
		const bytes = new TextEncoder().encode(JSON.stringify(doc));
		const r = await resolve("https://fixture/vote.jsonld", {
			skipVerification: true,
			fetchOptions: {
				fetch: (async () =>
					new Response(new Blob([bytes as unknown as BlobPart]), {
						status: 200,
					})) as unknown as typeof fetch,
			},
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.cipStandard).toBe("CIP-136");
	});

	test("verify pipeline runs by default (skipVerification: false)", async () => {
		const bytes = loadFixtureBytes("treasury-withdrawal.jsonld");
		const r = await resolve("https://fixture/treasury-withdrawal.jsonld", {
			fetchOptions: { fetch: makeFetchFor(bytes) },
			contextOptions: { policy: "bundled-only" },
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.verification).toBeDefined();
		// No witnesses → vacuously valid
		expect(r.data.verification?.valid).toBe(true);
	});

	test("anchorHash mismatch is reported in verification", async () => {
		const bytes = loadFixtureBytes("treasury-withdrawal.jsonld");
		const r = await resolve("https://fixture/treasury-withdrawal.jsonld", {
			anchorHash: "00".repeat(32),
			fetchOptions: { fetch: makeFetchFor(bytes) },
			contextOptions: { policy: "bundled-only" },
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.verification?.anchorHash?.valid).toBe(false);
	});

	test("fetch failure surfaces unchanged", async () => {
		const r = await resolve("https://fixture/missing.jsonld", {
			fetchOptions: {
				fetch: (async () =>
					new Response("not found", {
						status: 404,
						statusText: "Not Found",
					})) as unknown as typeof fetch,
			},
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.FETCH_FAILED);
	});
});
