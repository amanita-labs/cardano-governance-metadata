/**
 * Resolve metadata from any URI.
 *
 * resolve() is the all-in-one function: it fetches the metadata,
 * detects which CIP standard it conforms to, validates the schema,
 * verifies the anchor hash + signatures, and reports any extra fields.
 */
import { resolve } from "cardano-governance-metadata";

// Resolve from an IPFS URI, verifying against an on-chain anchor hash
const result = await resolve("ipfs://QmExampleCid", {
  anchorHash: "7b7d4a28a599bbb8c08b239be2645fa82d63a848320bf4760b07d86fcf1aabdc",
});

if (!result.success) {
  console.error("Failed:", result.error.code, result.error.message);
  process.exit(1);
}

const { cipStandard, document, extraFields, verification } = result.data;

// Which CIP standard was detected?
console.log(`CIP Standard: ${cipStandard}`);
// => "CIP-108", "CIP-119", "CIP-136", or "CIP-100"

// The full parsed document (with extra fields preserved)
console.log("Body:", document.body);

// Verification results
if (verification) {
  console.log("Anchor hash valid:", verification.anchorHash?.valid);
  console.log("All signatures valid:", verification.valid);

  for (const w of verification.witnesses) {
    console.log(
      `  Author #${w.authorIndex} (${w.authorName ?? "anonymous"}):`,
      w.signatureValid ? "valid" : "INVALID",
    );
  }
}

// Extra fields not defined by the detected CIP
if (extraFields.length > 0) {
  console.warn(`${extraFields.length} extra field(s) found:`);
  for (const field of extraFields) {
    console.warn(`  ${field.path}:`, field.value);
  }
}
