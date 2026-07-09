// Bundles each public entry point with `bun build`, replacing six
// hand-maintained package.json invocations that repeated the same flags.
// Flags must stay in sync with what check-dist-exports.mjs expects; cbor2 is
// deliberately NOT external (it is bundled into the output).
import { spawn } from "node:child_process";

const EXTERNALS = [
	"jsonld",
	"blakejs",
	"@noble/ed25519",
	"zod",
	"@emurgo/cardano-serialization-lib-nodejs",
	"@emurgo/cardano-serialization-lib-browser",
	"@emurgo/cardano-serialization-lib-asmjs",
];

const ENTRIES = [
	{ entry: "./src/index.ts", outdir: "./dist" },
	{ entry: "./src/cip100/index.ts", outdir: "./dist/cip100" },
	{ entry: "./src/cip108/index.ts", outdir: "./dist/cip108" },
	{ entry: "./src/cip119/index.ts", outdir: "./dist/cip119" },
	{ entry: "./src/cip136/index.ts", outdir: "./dist/cip136" },
	{ entry: "./src/cip169/index.ts", outdir: "./dist/cip169" },
];

function build({ entry, outdir }) {
	const args = [
		"build",
		entry,
		"--outdir",
		outdir,
		"--format",
		"esm",
		"--target",
		"node",
		...EXTERNALS.flatMap((name) => ["--external", name]),
	];
	return new Promise((resolve, reject) => {
		const child = spawn("bun", args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`bun build ${entry} exited with code ${code}`));
		});
	});
}

// The six bundles write to disjoint outdirs, so they can run concurrently.
await Promise.all(ENTRIES.map(build));
