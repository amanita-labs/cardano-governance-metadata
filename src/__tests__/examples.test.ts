import { describe, expect, test } from "bun:test";
import { resolve as nodeResolve } from "node:path";

const EXAMPLES_DIR = nodeResolve(
	import.meta.dir,
	"..",
	"..",
	"docs",
	"examples",
);

const NON_NETWORK_EXAMPLES = [
	"detect-and-parse.ts",
	"validate-cip108.ts",
	"validate-cip119.ts",
	"validate-cip136.ts",
	"error-handling.ts",
	"extra-fields.ts",
	"context-allowlist.ts",
	"cip169-compare.ts",
	"cip169-verify-tx.ts",
];

describe("examples — non-network examples should run cleanly", () => {
	for (const file of NON_NETWORK_EXAMPLES) {
		test(file, async () => {
			const proc = Bun.spawn(["bun", "run", file], {
				cwd: EXAMPLES_DIR,
				stdout: "pipe",
				stderr: "pipe",
			});
			const exitCode = await proc.exited;
			const stdout = await new Response(proc.stdout).text();
			const stderr = await new Response(proc.stderr).text();

			if (exitCode !== 0) {
				console.error(`\n--- ${file} stdout ---\n${stdout}`);
				console.error(`--- ${file} stderr ---\n${stderr}`);
			}
			expect(exitCode).toBe(0);
		}, 20_000);
	}
});
