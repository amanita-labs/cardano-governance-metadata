/**
 * Validate a CIP-119 DRep registration.
 *
 * CIP-119 defines DRep profile metadata:
 * - givenName (required, max 80 chars)
 * - objectives (max 1000 chars)
 * - motivations (max 1000 chars)
 * - qualifications (max 1000 chars)
 * - paymentAddress (bech32)
 * - image (with contentUrl and optional sha256 hash)
 * - references (Link or Identity types)
 * - doNotList (boolean, opts out of delegation tool visibility)
 */
import { cip119 } from "cardano-governance-metadata";

// Full DRep registration
const full = cip119.validate({
  "@context": {
    "CIP100": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
    "CIP119": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0119/README.md#",
    "hashAlgorithm": "CIP100:hashAlgorithm",
    "body": { "@id": "CIP119:body" },
  },
  hashAlgorithm: "blake2b-256",
  body: {
    givenName: "Ada Lovelace",
    objectives: "Champion transparent governance tooling for all Cardano users.",
    motivations:
      "Passionate about decentralized governance. " +
      "Previously contributed to multiple Catalyst proposals.",
    qualifications:
      "5 years of Cardano development experience. " +
      "Core contributor to two open-source wallet projects.",
    paymentAddress: "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3lr",
    image: {
      "@type": "ImageObject" as const,
      contentUrl: "https://example.com/avatar.png",
      sha256: "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
    },
    references: [
      {
        "@type": "Link" as const,
        label: "Twitter",
        uri: "https://twitter.com/ada_lovelace",
      },
      {
        "@type": "Identity" as const,
        label: "DRep ID Verification",
        uri: "https://ada-lovelace.com/drep-verification",
      },
    ],
    doNotList: false,
  },
});

if (full.success) {
  console.log("Valid DRep registration");
  console.log("Name:", full.data.body.givenName);
  console.log("Has image:", !!full.data.body.image);
  console.log("References:", full.data.body.references?.length ?? 0);
}

// Minimal DRep registration (only givenName is required)
const minimal = cip119.validate({
  "@context": {},
  hashAlgorithm: "blake2b-256",
  body: {
    givenName: "Minimal DRep",
  },
});

if (minimal.success) {
  console.log("\nMinimal DRep is also valid");
  console.log("Name:", minimal.data.body.givenName);
  console.log("Objectives:", minimal.data.body.objectives ?? "(not set)");
}

// Invalid: missing givenName
const missing = cip119.validate({
  "@context": {},
  hashAlgorithm: "blake2b-256",
  body: {
    objectives: "Some objectives",
  },
});

if (!missing.success) {
  console.log("\nExpected failure (missing givenName):");
  for (const issue of missing.error.issues) {
    console.log(`  ${issue.path}: ${issue.message}`);
    // => "body.givenName: Required"
  }
}
