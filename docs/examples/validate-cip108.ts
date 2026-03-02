/**
 * Validate a CIP-108 governance action.
 *
 * CIP-108 adds structured fields for governance proposals:
 * - title (max 80 chars, plain text)
 * - abstract (max 2500 chars, markdown)
 * - motivation (markdown)
 * - rationale (markdown)
 * - references with optional cryptographic hashes
 */
import { cip108, ErrorCode } from "cardano-governance-metadata";

// Valid governance action
const valid = cip108.validate({
  "@context": {
    "CIP100": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
    "CIP108": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0108/README.md#",
    "hashAlgorithm": "CIP100:hashAlgorithm",
    "body": {
      "@id": "CIP108:body",
      "@context": {
        "title": "CIP108:title",
        "abstract": "CIP108:abstract",
        "motivation": "CIP108:motivation",
        "rationale": "CIP108:rationale",
      },
    },
  },
  hashAlgorithm: "blake2b-256",
  body: {
    title: "Increase K parameter to 100,000",
    abstract:
      "This proposal increases the K parameter from 500 to 100,000 " +
      "to improve decentralization of the Cardano network.",
    motivation:
      "The current K parameter of 500 limits the number of effective " +
      "stake pools. Increasing it encourages a more distributed network.",
    rationale:
      "By increasing K, we incentivize delegation to smaller pools, " +
      "reducing the dominance of large multi-pool operators.",
    references: [
      {
        "@type": "Other" as const,
        label: "Research Paper",
        uri: "https://example.com/k-parameter-analysis.pdf",
        referenceHash: {
          hashDigest: "a1b2c3d4e5f6...",
          hashAlgorithm: "blake2b-256" as const,
        },
      },
    ],
  },
});

if (valid.success) {
  console.log("Valid CIP-108 governance action");
  console.log("Title:", valid.data.body.title);
} else {
  console.error("Validation failed:", valid.error.message);
}

// Invalid: title exceeds 80 characters
const tooLong = cip108.validate({
  "@context": {},
  hashAlgorithm: "blake2b-256",
  body: {
    title: "A".repeat(81), // 81 chars - exceeds limit
    abstract: "Valid abstract",
    motivation: "Valid motivation",
    rationale: "Valid rationale",
  },
});

if (!tooLong.success) {
  console.log("\nExpected validation failure:");
  console.log("Error code:", tooLong.error.code);
  // => "SCHEMA_VALIDATION_FAILED"

  if (tooLong.error.code === ErrorCode.SCHEMA_VALIDATION_FAILED) {
    for (const issue of tooLong.error.issues) {
      console.log(`  ${issue.path}: ${issue.message}`);
      // => "body.title: String must contain at most 80 character(s)"
    }
  }
}
