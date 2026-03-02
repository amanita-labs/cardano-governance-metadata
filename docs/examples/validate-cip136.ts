/**
 * Validate a CIP-136 Constitutional Committee vote rationale.
 *
 * CIP-136 defines CC vote metadata:
 * - summary (required, max 300 chars, plain text)
 * - rationaleStatement (required, markdown)
 * - precedentDiscussion (optional, markdown)
 * - counterargumentDiscussion (optional, markdown)
 * - conclusion (optional, plain text)
 * - internalVote (optional, vote breakdown for multi-member orgs)
 * - references with RelevantArticles type for citing constitution sections
 */
import { cip136 } from "cardano-governance-metadata";

const result = cip136.validate({
  "@context": {
    "CIP100": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md#",
    "CIP136": "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0136/README.md#",
    "hashAlgorithm": "CIP100:hashAlgorithm",
    "body": { "@id": "CIP136:body" },
  },
  hashAlgorithm: "blake2b-256",
  authors: [
    {
      name: "Constitutional Committee Org",
      witness: {
        witnessAlgorithm: "ed25519",
        publicKey: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890",
        signature:
          "deadbeef".repeat(16), // 128 hex chars placeholder
      },
    },
  ],
  body: {
    summary:
      "Constitutional - this governance action aligns with Article 3, " +
      "Section 5 of the Cardano Constitution regarding treasury withdrawals.",
    rationaleStatement:
      "## Analysis\n\n" +
      "After thorough review, the committee finds this governance action " +
      "is constitutional. The proposed treasury withdrawal follows the " +
      "procedures outlined in Article 3, Section 5.\n\n" +
      "## Key Points\n\n" +
      "- The amount requested is within established guidelines\n" +
      "- The proposal includes clear deliverables and timelines\n" +
      "- Community feedback has been incorporated",
    precedentDiscussion:
      "A similar treasury withdrawal was approved in Epoch 450 " +
      "(Gov Action ID: abc123). The committee applied the same " +
      "constitutional framework in that decision.",
    counterargumentDiscussion:
      "Some community members raised concerns about the timeline. " +
      "However, the constitution does not impose specific timeline " +
      "requirements for treasury actions of this category.",
    conclusion: "We vote Yes on constitutional grounds.",
    internalVote: {
      constitutional: 5,
      unconstitutional: 1,
      abstain: 1,
      didNotVote: 0,
    },
    references: [
      {
        "@type": "RelevantArticles" as const,
        label: "Article 3, Section 5 - Treasury Withdrawals",
        uri: "https://constitution.gov.cardano.org/articles/3#section-5",
      },
      {
        "@type": "Other" as const,
        label: "Community Discussion Thread",
        uri: "https://forum.cardano.org/t/treasury-proposal-discussion/12345",
      },
    ],
  },
});

if (result.success) {
  const { body } = result.data;
  console.log("Valid CC vote rationale");
  console.log("Summary:", body.summary);
  console.log("Has precedent discussion:", !!body.precedentDiscussion);
  console.log("Has counterarguments:", !!body.counterargumentDiscussion);
  console.log("Conclusion:", body.conclusion);

  if (body.internalVote) {
    const v = body.internalVote;
    console.log(
      `Internal vote: ${v.constitutional} for, ` +
      `${v.unconstitutional} against, ${v.abstain} abstain`,
    );
  }

  const articles = body.references?.filter((r) => r["@type"] === "RelevantArticles");
  if (articles?.length) {
    console.log("Cited articles:");
    for (const a of articles) {
      console.log(`  - ${a.label}: ${a.uri}`);
    }
  }
} else {
  console.error("Validation failed:");
  for (const issue of result.error.issues) {
    console.error(`  ${issue.path}: ${issue.message}`);
  }
}
