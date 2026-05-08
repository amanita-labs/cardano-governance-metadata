import { describe, expect, test } from "bun:test";
import { compareOnChain, stripSelfAnchor } from "../index.js";

const baseProposal = {
  deposit: "100000000000",
  reward_account: "stake1ux1",
  gov_action: {
    tag: "treasury_withdrawals_action",
    rewards: [{ key: "stake1abc", value: "100000000000" }],
  },
};

describe("cip169.compareOnChain", () => {
  test("equal proposal procedures match", () => {
    const r = compareOnChain(baseProposal, baseProposal);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.equal).toBe(true);
      expect(r.data.differences).toEqual([]);
    }
  });

  test("differing reward address surfaces in diff", () => {
    const tampered = JSON.parse(JSON.stringify(baseProposal));
    tampered.gov_action.rewards[0].key = "stake1evil";
    const r = compareOnChain(baseProposal, tampered);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.equal).toBe(false);
      expect(r.data.differences.some((d) => d.path.includes("rewards"))).toBe(
        true,
      );
    }
  });

  test("strips self-anchor before comparing", () => {
    const metadata = baseProposal;
    const onChainWithAnchor = {
      ...baseProposal,
      anchor: { url: "https://example.com/a.jsonld", data_hash: "ab".repeat(32) },
    };
    const r = compareOnChain(metadata, onChainWithAnchor);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.equal).toBe(true);
  });

  test("keeps Constitution.anchor on new_constitution actions", () => {
    const newConst = {
      deposit: "1000",
      reward_account: "stake1...",
      gov_action: {
        tag: "new_constitution",
        constitution: {
          anchor: { url: "https://const", data_hash: "cd".repeat(32) },
        },
      },
    };
    const stripped = stripSelfAnchor(newConst) as typeof newConst;
    expect(stripped.gov_action.constitution.anchor).toBeDefined();
  });

  test("strips inner VotingProcedure.anchor from voting procedures", () => {
    const procs = [
      {
        key: { tag: "drep_credential" },
        value: [
          {
            key: { transaction_id: "ab", gov_action_index: "0" },
            value: { vote: "yes", anchor: { url: "x", data_hash: "y" } },
          },
        ],
      },
    ];
    const stripped = stripSelfAnchor(procs) as typeof procs;
    const inner = stripped[0].value[0].value as Record<string, unknown>;
    expect(inner.anchor).toBeUndefined();
    expect(inner.vote).toBe("yes");
  });
});
