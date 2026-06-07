/**
 * Post-build sanity check: assert the built `dist/` actually exports the
 * public runtime API.
 *
 * Why this exists: `bun build` 1.3.x regressed on this re-export-heavy entry —
 * it emitted a stub `dist/index.js` containing only `export { cip100, ErrorCode,
 * … }` with no definitions, so every named export was `undefined`. `bun build`
 * still exited 0 and the test suite (which imports `src/`, not `dist/`) stayed
 * green, so the breakage only surfaced in a downstream bundler. This guard makes
 * `bun run build` — and therefore `prepublishOnly` and CI — fail loudly instead
 * of shipping a broken package to npm.
 */

const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
};

const ROOT_EXPORTS = [
  "detectCipStandard",
  "resolve",
  "fetchMetadata",
  "cip100",
  "cip108",
  "cip119",
  "cip136",
  "cip169",
  "registerContext",
  "unregisterContext",
  "clearRegisteredContexts",
  "listBundledContextUrls",
  "createDocumentLoader",
  "decodeCoseSign1",
  "verifyCip8Witness",
  "ErrorCode",
  "GovernanceMetadataError",
  "FetchError",
  "ParseError",
  "ValidationError",
  "VerificationError",
];

const CIP_MODULES = ["cip100", "cip108", "cip119", "cip136", "cip169"];
const CIP_VERBS = ["parse", "validate", "build"];

const root = await import("../dist/index.js");

const missingRoot = ROOT_EXPORTS.filter((k) => root[k] === undefined);
if (missingRoot.length) {
  fail(`dist/index.js missing exports: ${missingRoot.join(", ")}`);
}

// Each CIP namespace (root re-export) must expose its core verbs.
for (const name of CIP_MODULES) {
  const ns = root[name];
  if (!ns) continue; // already reported as missing above
  for (const verb of CIP_VERBS) {
    if (typeof ns[verb] !== "function") fail(`${name}.${verb} is not a function`);
  }
}

// The subpath bundles (./cipNNN) are built separately and imported directly by
// consumers — verify each independently.
for (const name of CIP_MODULES) {
  try {
    const mod = await import(`../dist/${name}/index.js`);
    for (const verb of CIP_VERBS) {
      if (typeof mod[verb] !== "function") {
        fail(`dist/${name}/index.js missing ${verb}()`);
      }
    }
  } catch (e) {
    fail(`dist/${name}/index.js failed to import: ${e instanceof Error ? e.message : e}`);
  }
}

if (process.exitCode) {
  console.error(
    "\nLibrary dist is incomplete — likely a `bun build` regression. " +
      "Pin a known-good bun (1.2.13) and rebuild.",
  );
} else {
  console.log(
    `  ✓ dist exports verified: root (${ROOT_EXPORTS.length}) + ${CIP_MODULES.length} subpath bundles`,
  );
}
