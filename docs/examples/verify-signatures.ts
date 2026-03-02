/**
 * Verify anchor hash and ed25519 witness signatures.
 *
 * The verification pipeline:
 * 1. Fetch raw bytes from the URI
 * 2. blake2b-256(raw bytes) -> compare with on-chain anchor hash
 * 3. For each author with a witness:
 *    a. Canonicalize the body using JSON-LD URDNA2015
 *    b. blake2b-256(canonicalized N-Quads) -> body hash
 *    c. ed25519.verify(signature, bodyHash, publicKey)
 */
import { cip100 } from "cardano-governance-metadata";

// Verify from a URI with an on-chain anchor hash
const result = await cip100.verify(
  { uri: "https://metadata.example.com/governance-action.jsonld" },
  {
    anchorHash: "7b7d4a28a599bbb8c08b239be2645fa82d63a848320bf4760b07d86fcf1aabdc",
  },
);

if (result.success) {
  const { anchorHash, witnesses, valid } = result.data;

  // Overall result
  console.log("Overall valid:", valid);

  // Anchor hash check
  if (anchorHash) {
    console.log("Anchor hash valid:", anchorHash.valid);
    if (!anchorHash.valid) {
      console.warn("  Expected:", anchorHash.expected);
      console.warn("  Computed:", anchorHash.computed);
      console.warn("  WARNING: metadata may have been tampered with!");
    }
  }

  // Witness signature checks
  for (const w of witnesses) {
    console.log(
      `Author #${w.authorIndex} "${w.authorName ?? "anonymous"}":`,
      w.signatureValid ? "signature valid" : "SIGNATURE INVALID",
    );
    console.log(`  Public key: ${w.publicKey}`);
  }
} else {
  console.error("Verification failed:", result.error.message);
}

// You can also verify pre-fetched raw bytes
const rawBytes = new Uint8Array(/* ... */);
const fromBytes = await cip100.verify(
  { rawBytes },
  { anchorHash: "abc123..." },
);

// Or verify an already-parsed document (skip anchor hash check)
const doc = { /* parsed document */ };
const fromDoc = await cip100.verify(
  { document: doc as Record<string, unknown> },
  { skipWitnessVerification: false },
);
