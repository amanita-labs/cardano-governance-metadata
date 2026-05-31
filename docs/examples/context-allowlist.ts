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
import {
  clearRegisteredContexts,
  createDocumentLoader,
  registerContext,
} from "../../src/index.js";

const CUSTOM_CTX_URL =
  "https://intersectmbo.github.io/governance-actions/v1.1.0/schemas/hard-fork-initiation/common.jsonld";

// In a real app, you'd load the JSON-LD from disk or your build pipeline.
// Here we inline a tiny context so the example is self-contained.
const customJsonld = {
  "@context": {
    "@vocab": "https://example.com/vocab/",
    title: "https://example.com/vocab/title",
  },
};

// ─── 1. registerContext — predictable, repeatable verification ─────
clearRegisteredContexts();
registerContext(CUSTOM_CTX_URL, customJsonld);

const loader1 = createDocumentLoader({ policy: "bundled-only" });
const r1 = await loader1(CUSTOM_CTX_URL);
console.log(
  "registerContext: resolved URL offline =",
  r1.documentUrl === CUSTOM_CTX_URL,
);

// ─── 2. allowlist — fetch matching URLs at runtime ─────────────────
// Globs: * = single path segment, ** = multi-segment.
const loader2 = createDocumentLoader({
  policy: "allowlist",
  allowlist: ["https://intersectmbo.github.io/governance-actions/v*/**"],
  fetch: (async (url: string | URL | Request) => {
    const u = typeof url === "string" ? url : url.toString();
    console.log("  fetched:", u);
    return new Response(JSON.stringify(customJsonld), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch,
});
const r2 = await loader2(CUSTOM_CTX_URL);
console.log("allowlist: matched and fetched =", r2.documentUrl === CUSTOM_CTX_URL);

// ─── 3. overrides — exact-URL injection per call ───────────────────
const loader3 = createDocumentLoader({
  policy: "bundled-only",
  overrides: { [CUSTOM_CTX_URL]: customJsonld },
});
const r3 = await loader3(CUSTOM_CTX_URL);
console.log("overrides: returned the override doc =", JSON.stringify(r3.document) === JSON.stringify(customJsonld));

clearRegisteredContexts();
