import { describe, expect, test } from "bun:test";
import { CIP136_CONTEXT_URL } from "../../core/default-contexts.js";
import { build } from "../build.js";
import { parse } from "../parse.js";

const minimalBody = {
	summary: "Voting yes — proposal aligns with constitution.",
	rationaleStatement:
		"After review of the proposal against constitutional principles, this committee member supports it.",
};

describe("cip136.build", () => {
	test("builds a minimal constitutional committee vote-rationale document", () => {
		const result = build({ body: minimalBody });
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("unreachable");
		expect(result.data.doc["@context"]).toBe(CIP136_CONTEXT_URL);
		expect(result.data.doc.body).toEqual(minimalBody);
	});

	test("round-trips through parse()", () => {
		const built = build({ body: minimalBody });
		if (!built.success) throw new Error("build failed");
		const parsed = parse(built.data.json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) throw new Error("unreachable");
		expect(parsed.data).toEqual(built.data.doc);
	});

	test("rejects summary over 300 chars", () => {
		const result = build({
			body: { ...minimalBody, summary: "X".repeat(301) },
		});
		expect(result.success).toBe(false);
		if (result.success) throw new Error("unreachable");
		expect(result.error.issues.some((i) => i.path.includes("summary"))).toBe(
			true,
		);
	});

	// JSON Schema maxLength counts Unicode code points, not UTF-16 code units.
	test("counts summary limit in code points, not UTF-16 code units", () => {
		const result = build({
			body: { ...minimalBody, summary: "🎉".repeat(300) },
		});
		expect(result.success).toBe(true);

		const overLimit = build({
			body: { ...minimalBody, summary: "🎉".repeat(301) },
		});
		expect(overLimit.success).toBe(false);
	});
});
