import { describe, expect, test } from "bun:test";
import { CIP108_CONTEXT_URL } from "../../core/default-contexts.js";
import { ValidationError } from "../../core/errors.js";
import { build } from "../build.js";
import { parse } from "../parse.js";

const minimalBody = {
	title: "Fund Development Team",
	abstract: "Withdraw 100k ADA to fund development team for Q3.",
	motivation:
		"The team has delivered milestones and requires funding for continued work.",
	rationale:
		"Funding will enable completion of the remaining project deliverables in the next quarter.",
};

describe("cip108.build", () => {
	test("builds a minimal valid document with auto-injected @context and hashAlgorithm", () => {
		const result = build({ body: minimalBody });

		expect(result.success).toBe(true);
		if (!result.success) throw new Error("unreachable");
		expect(result.data.doc["@context"]).toBe(CIP108_CONTEXT_URL);
		expect(result.data.doc.hashAlgorithm).toBe("blake2b-256");
		expect(result.data.doc.body).toEqual(minimalBody);
		// authors omitted when not provided
		expect(result.data.doc.authors).toBeUndefined();
	});

	test("returns a pretty-printed JSON string that parses back to the same doc", () => {
		const result = build({ body: minimalBody });
		if (!result.success) throw new Error("unreachable");
		expect(result.data.json).toContain("\n");
		expect(JSON.parse(result.data.json)).toEqual(result.data.doc);
	});

	test("round-trips through parse() — built output passes parse()", () => {
		const built = build({ body: minimalBody });
		if (!built.success) throw new Error("build failed");

		const parsed = parse(built.data.json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) throw new Error("unreachable");
		expect(parsed.data).toEqual(built.data.doc);
	});

	test("includes authors when provided", () => {
		const authors = [{ name: "Ryan", witness: undefined }];
		const result = build({ body: minimalBody, authors });
		if (!result.success) throw new Error("unreachable");
		expect(result.data.doc.authors).toEqual(authors);
	});

	test("allows custom @context override", () => {
		const customContext = ["https://example.com/custom-context.jsonld"];
		const result = build({ body: minimalBody, context: customContext });
		if (!result.success) throw new Error("unreachable");
		expect(result.data.doc["@context"]).toEqual(customContext);
	});

	test("returns ValidationError when title exceeds 80 chars", () => {
		const result = build({
			body: { ...minimalBody, title: "X".repeat(81) },
		});
		expect(result.success).toBe(false);
		if (result.success) throw new Error("unreachable");
		expect(result.error).toBeInstanceOf(ValidationError);
		expect(result.error.issues.some((i) => i.path.includes("title"))).toBe(
			true,
		);
	});

	test("returns ValidationError when required body field missing", () => {
		const { motivation: _omit, ...incompleteBody } = minimalBody;
		const result = build({
			// @ts-expect-error intentionally missing required field
			body: incompleteBody,
		});
		expect(result.success).toBe(false);
		if (result.success) throw new Error("unreachable");
		expect(result.error.issues.some((i) => i.path.includes("motivation"))).toBe(
			true,
		);
	});
});
