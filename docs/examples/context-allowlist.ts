/**
 * Resolve metadata whose @context is a remote URI not bundled in the library.
 *
 * The default policy ("allowlist" with no entries) errors with MISSING_CONTEXT
 * rather than silently fetching — fetching unknown contexts would make
 * signature verification non-reproducible. To allow specific URIs, either:
 *
 *   1. registerContext(url, doc) — load the JSON-LD locally and inject it,
 *   2. contextOptions.allowlist — pass globs/regex of URLs to allow fetching,
 *   3. contextOptions.overrides — exact-URL → context object map.
 *
 * Run: bun run docs/examples/context-allowlist.ts
 */
import { readFileSync } from "node:fs";
import { registerContext, resolve } from "../../src/index.js";

const MBO_HARD_FORK_CTX_URL =
  "https://intersectmbo.github.io/governance-actions/v1.1.0/schemas/hard-fork-initiation/common.jsonld";

// 1. registerContext — best for predictable, repeatable verification.
// Pre-load the JSON-LD from disk (or your build pipeline) once at startup.
const localJsonld = JSON.parse(
  readFileSync("./contexts/intersectmbo-hard-fork-initiation.common.jsonld", "utf8"),
);
registerContext(MBO_HARD_FORK_CTX_URL, localJsonld);

const r1 = await resolve("ipfs://QmExampleCid");
console.log("registered context — success:", r1.success);

// 2. allowlist — let the library fetch contexts that match the pattern,
// caching them in memory for the duration of the call. Globs: * = single
// path segment, ** = multi-segment.
const r2 = await resolve("ipfs://QmExampleCid", {
  contextOptions: {
    policy: "allowlist",
    allowlist: ["https://intersectmbo.github.io/governance-actions/v*/**"],
  },
});
console.log("allowlist — success:", r2.success);

// 3. overrides — one-shot exact-URL injection per call. Useful when you need
// to pin a specific context version per request.
const r3 = await resolve("ipfs://QmExampleCid", {
  contextOptions: {
    overrides: { [MBO_HARD_FORK_CTX_URL]: localJsonld },
  },
});
console.log("override — success:", r3.success);
