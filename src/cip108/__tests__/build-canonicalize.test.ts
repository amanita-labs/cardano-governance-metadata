import { describe, expect, test } from "bun:test";
import { canonicalizeBody } from "../../core/canonicalize.js";
import { build } from "../build.js";

const minimalBody = {
	title: "Fund Development Team",
	abstract: "Withdraw 100k ADA to fund development team for Q3.",
	motivation:
		"The team has delivered milestones and requires funding for continued work.",
	rationale:
		"Funding will enable completion of the remaining project deliverables in the next quarter.",
};

describe("cip108.build → canonicalizeBody", () => {
	test("builder output canonicalizes to non-empty N-Quads under the bundled CIP-108 context", async () => {
		const result = build({ body: minimalBody });
		if (!result.success) throw new Error("build failed");

		const canonical = await canonicalizeBody(
			result.data.doc as unknown as Record<string, unknown>,
		);
		expect(canonical.success).toBe(true);
		if (!canonical.success) throw new Error("canonicalize failed");
		expect(canonical.data.length).toBeGreaterThan(0);
		expect(canonical.data.endsWith("\n")).toBe(true);
	});

	test("two identical builds produce identical canonical N-Quads (deterministic)", async () => {
		const a = build({ body: minimalBody });
		const b = build({ body: minimalBody });
		if (!a.success || !b.success) throw new Error("build failed");

		const [canonA, canonB] = await Promise.all([
			canonicalizeBody(a.data.doc as unknown as Record<string, unknown>),
			canonicalizeBody(b.data.doc as unknown as Record<string, unknown>),
		]);
		if (!canonA.success || !canonB.success) throw new Error("canon failed");
		expect(canonA.data).toBe(canonB.data);
	});
});
