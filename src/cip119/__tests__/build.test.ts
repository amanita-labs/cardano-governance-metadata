import { describe, expect, test } from "bun:test";
import { CIP119_CONTEXT_URL } from "../../core/default-contexts.js";
import { build } from "../build.js";
import { parse } from "../parse.js";

describe("cip119.build", () => {
	test("builds a minimal DRep metadata document", () => {
		const result = build({ body: { givenName: "Ryan Williams" } });
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("unreachable");
		expect(result.data.doc["@context"]).toBe(CIP119_CONTEXT_URL);
		expect(result.data.doc.body.givenName).toBe("Ryan Williams");
	});

	test("round-trips through parse()", () => {
		const built = build({
			body: {
				givenName: "Ryan Williams",
				objectives: "Sustainable governance",
				motivations: "I care about Cardano's future",
			},
		});
		if (!built.success) throw new Error("build failed");
		const parsed = parse(built.data.json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) throw new Error("unreachable");
		expect(parsed.data).toEqual(built.data.doc);
	});

	test("rejects givenName over 80 chars", () => {
		const result = build({ body: { givenName: "X".repeat(81) } });
		expect(result.success).toBe(false);
		if (result.success) throw new Error("unreachable");
		expect(result.error.issues.some((i) => i.path.includes("givenName"))).toBe(
			true,
		);
	});

	// JSON Schema maxLength counts Unicode code points, not UTF-16 code units.
	test("counts givenName limit in code points, not UTF-16 code units", () => {
		const result = build({ body: { givenName: "🎉".repeat(80) } });
		expect(result.success).toBe(true);

		const overLimit = build({ body: { givenName: "🎉".repeat(81) } });
		expect(overLimit.success).toBe(false);
	});
});
