import { describe, expect, test } from "bun:test";
import { CIP100_CONTEXT_URL } from "../../core/default-contexts.js";
import { ValidationError } from "../../core/errors.js";
import { build } from "../build.js";
import { parse } from "../parse.js";

describe("cip100.build", () => {
	test("builds an empty-body document with defaults", () => {
		const result = build({ body: {} });
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("unreachable");
		expect(result.data.doc["@context"]).toBe(CIP100_CONTEXT_URL);
		expect(result.data.doc.hashAlgorithm).toBe("blake2b-256");
		expect(result.data.doc.body).toEqual({});
	});

	test("round-trips through parse()", () => {
		const built = build({
			body: { comment: "anchored by the proposer" },
		});
		if (!built.success) throw new Error("build failed");
		const parsed = parse(built.data.json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) throw new Error("unreachable");
		expect(parsed.data).toEqual(built.data.doc);
	});

	test("rejects an invalid hashAlgorithm override", () => {
		const result = build({
			body: {},
			// @ts-expect-error invalid literal
			hashAlgorithm: "sha256",
		});
		expect(result.success).toBe(false);
		if (result.success) throw new Error("unreachable");
		expect(result.error).toBeInstanceOf(ValidationError);
	});
});
