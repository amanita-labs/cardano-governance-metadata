/**
 * Compare two CIP-169 onChain values directly, without involving a transaction.
 *
 * Useful when:
 * - You want to diff a draft metadata onChain against a submitted version,
 * - You want to detect drift between two off-chain copies of the same proposal,
 * - You're building tooling that validates metadata before submission.
 *
 * `compareOnChain(metadata, action)` strips self-referential anchors from
 * proposal/cert/voting structures (per CIP-169) before comparing, so anchors
 * don't cause false mismatches.
 *
 * Run: bun run docs/examples/cip169-compare.ts
 */
import { cip169 } from "../../src/index.js";

const draftProposal = {
  deposit: "100000000000",
  reward_account: "stake1uxsm9s75uhm20wxf6rsl9ga5chtw079fkrqa9cl55kmv0kqfk32j7",
  gov_action: {
    tag: "treasury_withdrawals_action",
    rewards: [
      {
        key: "stake1uxsm9s75uhm20wxf6rsl9ga5chtw079fkrqa9cl55kmv0kqfk32j7",
        value: "100000000000",
      },
    ],
  },
};

// Identical structure but with a self-referential anchor that the comparator
// is expected to strip out before diffing.
const submittedProposalWithAnchor = {
  ...draftProposal,
  anchor: {
    url: "https://example.com/metadata.jsonld",
    data_hash: "ab".repeat(32),
  },
};

// Tampered version: someone changed the recipient stake address.
const tamperedProposal = JSON.parse(JSON.stringify(draftProposal));
tamperedProposal.gov_action.rewards[0].key = "stake1evilattacker";

function show(label: string, result: ReturnType<typeof cip169.compareOnChain>): void {
  console.log(`\n--- ${label} ---`);
  if (!result.success) {
    console.log("error:", result.error.code, result.error.message);
    return;
  }
  if (result.data.equal) {
    console.log("equal: ✓");
    return;
  }
  console.log("equal: ✗");
  for (const d of result.data.differences) {
    console.log(
      `  ${d.path}: ${JSON.stringify(d.metadataValue)} ≠ ${JSON.stringify(
        d.actionValue,
      )}`,
    );
  }
}

show(
  "draft vs submitted (with self-anchor) — should match",
  cip169.compareOnChain(draftProposal, submittedProposalWithAnchor),
);

show(
  "draft vs tampered — should diff at gov_action.rewards[0].key",
  cip169.compareOnChain(draftProposal, tamperedProposal),
);
