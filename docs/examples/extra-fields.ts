/**
 * Handling extra (unknown) fields in governance metadata.
 *
 * CIP-100 is designed to be extensible — documents may contain fields
 * from future CIPs or community-defined extensions. This library:
 *
 * 1. Preserves extra fields in the parsed document (never strips them)
 * 2. Reports them separately so consumers can warn users
 * 3. Validates known fields while passing through unknown ones
 */
import { resolve, cip119, detectCipStandard } from "cardano-governance-metadata";

// --- Using resolve() (reports extra fields automatically) ---

const result = await resolve("https://example.com/drep-metadata.jsonld");

if (result.success) {
  const { cipStandard, document, extraFields } = result.data;
  console.log(`Detected: ${cipStandard}`);

  // Extra fields are listed with their path and value
  if (extraFields.length > 0) {
    console.warn(`Found ${extraFields.length} field(s) not defined by ${cipStandard}:`);
    for (const field of extraFields) {
      console.warn(`  ${field.path}:`, field.value);
    }
    // Example output:
    //   body.socialLinks: ["https://twitter.com/..."]
    //   body.delegationStrategy: "follow-the-coin"
    //   customField: { some: "data" }
  }

  // The extra fields are still accessible on the document
  const body = (document as Record<string, unknown>).body as Record<string, unknown>;
  console.log("Custom field:", body["socialLinks"]);
}

// --- Using parse() directly (extra fields preserved) ---

const doc = {
  "@context": {},
  hashAlgorithm: "blake2b-256" as const,
  body: {
    givenName: "DRep with extras",
    objectives: "Test extra fields",
    // These are NOT defined by CIP-119 but will be preserved
    customBio: "I am a custom field from a future CIP extension",
    socialLinks: [
      { platform: "twitter", handle: "@example" },
    ],
  },
  // Top-level extra field
  version: "2.0",
};

const parsed = cip119.parse(doc);

if (parsed.success) {
  // Known fields are typed
  console.log("Name:", parsed.data.body.givenName);
  console.log("Objectives:", parsed.data.body.objectives);

  // Extra fields are preserved on the object (accessible via index)
  const body = parsed.data.body as unknown as Record<string, unknown>;
  console.log("Custom bio:", body["customBio"]);
  console.log("Social links:", body["socialLinks"]);
}

// --- Manually detecting extra fields ---

const standard = detectCipStandard(doc);
if (standard === "CIP-119") {
  const knownBodyFields = new Set([
    "references", "comment", "externalUpdates",
    "givenName", "image", "objectives", "motivations",
    "qualifications", "paymentAddress", "doNotList",
  ]);

  const body = doc.body as Record<string, unknown>;
  const extras = Object.keys(body).filter((k) => !knownBodyFields.has(k));

  if (extras.length > 0) {
    console.log("Extra body fields:", extras);
    // => ["customBio", "socialLinks"]
  }
}
