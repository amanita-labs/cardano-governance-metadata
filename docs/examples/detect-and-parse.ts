/**
 * Detect which CIP standard a document uses and parse it
 * with the correct typed schema.
 *
 * This is useful when you have raw JSON and want type-safe
 * access to the body fields for the specific CIP.
 */
import {
  detectCipStandard,
  cip100,
  cip108,
  cip119,
  cip136,
} from "cardano-governance-metadata";

const rawJson = `{
  "@context": {
    "CIP100": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
    "CIP119": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0119/README.md#",
    "hashAlgorithm": "CIP100:hashAlgorithm",
    "body": { "@id": "CIP119:body" }
  },
  "hashAlgorithm": "blake2b-256",
  "body": {
    "givenName": "Ada Lovelace",
    "objectives": "Champion transparent governance tooling"
  }
}`;

const doc = JSON.parse(rawJson);
const standard = detectCipStandard(doc);

console.log(`Detected standard: ${standard}`); // => "CIP-119"

switch (standard) {
  case "CIP-100": {
    const result = cip100.parse(doc);
    if (result.success) {
      console.log("Comment:", result.data.body.comment);
    }
    break;
  }
  case "CIP-108": {
    const result = cip108.parse(doc);
    if (result.success) {
      console.log("Title:", result.data.body.title);
      console.log("Abstract:", result.data.body.abstract);
      console.log("Motivation:", result.data.body.motivation);
      console.log("Rationale:", result.data.body.rationale);
    }
    break;
  }
  case "CIP-119": {
    const result = cip119.parse(doc);
    if (result.success) {
      console.log("DRep Name:", result.data.body.givenName);
      console.log("Objectives:", result.data.body.objectives);
      console.log("Motivations:", result.data.body.motivations);
      console.log("Qualifications:", result.data.body.qualifications);
      console.log("Payment Address:", result.data.body.paymentAddress);
      console.log("Do Not List:", result.data.body.doNotList);
    }
    break;
  }
  case "CIP-136": {
    const result = cip136.parse(doc);
    if (result.success) {
      console.log("Summary:", result.data.body.summary);
      console.log("Rationale:", result.data.body.rationaleStatement);
      console.log("Internal Vote:", result.data.body.internalVote);
    }
    break;
  }
  default:
    console.error("Unknown document format");
}
