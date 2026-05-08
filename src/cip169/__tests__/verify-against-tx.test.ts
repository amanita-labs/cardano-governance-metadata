import { beforeAll, describe, expect, test } from "bun:test";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { setCardanoSerializationLib, verifyAgainstTx } from "../index.js";
import { buildDrepRegistrationTx, buildTreasuryWithdrawalTx } from "./fixtures/build-tx.js";

beforeAll(() => {
  setCardanoSerializationLib(CSL);
});

const RECIPIENT_HEX = "44".repeat(28);
const RECIPIENT_BECH32 = CSL.RewardAddress.new(
  1,
  CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex(RECIPIENT_HEX)),
)
  .to_address()
  .to_bech32();
const PROPOSAL_REWARD = CSL.RewardAddress.new(
  1,
  CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex("11".repeat(28))),
)
  .to_address()
  .to_bech32();

describe("cip169.verifyAgainstTx", () => {
  test("matches honest treasury withdrawal", async () => {
    const { txHex } = buildTreasuryWithdrawalTx({
      recipientStakeKeyHashHex: RECIPIENT_HEX,
      amountLovelace: "100000000000",
      deposit: "100000000000",
    });

    const metadata = {
      hashAlgorithm: "blake2b-256",
      body: {
        title: "Fund Project",
        abstract: "Withdraw funds for project work",
        motivation: "Project needs funds",
        rationale: "We delivered milestones",
        onChain: {
          deposit: "100000000000",
          reward_account: PROPOSAL_REWARD,
          gov_action: {
            tag: "treasury_withdrawals_action",
            rewards: [{ key: RECIPIENT_BECH32, value: "100000000000" }],
          },
        },
      },
    };

    const r = await verifyAgainstTx(metadata, txHex);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.matched).toBe(true);
    expect(r.data.selectorUsed.kind).toBe("proposalProcedure");
  });

  test("flags tampered reward address", async () => {
    const { txHex } = buildTreasuryWithdrawalTx({
      recipientStakeKeyHashHex: RECIPIENT_HEX,
      amountLovelace: "100000000000",
    });

    const metadata = {
      hashAlgorithm: "blake2b-256",
      body: {
        title: "Fund Project",
        abstract: "...",
        motivation: "...",
        rationale: "...",
        onChain: {
          deposit: "100000000000",
          reward_account: PROPOSAL_REWARD,
          gov_action: {
            tag: "treasury_withdrawals_action",
            rewards: [
              {
                key: "stake1evil0000000000000000000000000000000000000000000000",
                value: "100000000000",
              },
            ],
          },
        },
      },
    };

    const r = await verifyAgainstTx(metadata, txHex);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.matched).toBe(false);
    if (r.data.matched) return;
    expect(
      r.data.differences.some((d) =>
        d.path.startsWith("gov_action.rewards"),
      ),
    ).toBe(true);
  });

  test("matches a register_drep certificate", async () => {
    const drepHex = "55".repeat(28);
    const { txHex } = buildDrepRegistrationTx({
      drepKeyHashHex: drepHex,
      coin: "500000000",
    });

    const metadata = {
      hashAlgorithm: "blake2b-256",
      body: {
        givenName: "Test DRep",
        onChain: {
          tag: "register_drep",
          drep_credential: { tag: "pubkey_hash", value: drepHex },
          coin: "500000000",
        },
      },
    };

    const r = await verifyAgainstTx(metadata, txHex);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.matched).toBe(true);
    expect(r.data.selectorUsed.kind).toBe("certificate");
  });

  test("errors when metadata has no body.onChain", async () => {
    const { txHex } = buildTreasuryWithdrawalTx({
      recipientStakeKeyHashHex: RECIPIENT_HEX,
      amountLovelace: "1",
    });
    const r = await verifyAgainstTx(
      { hashAlgorithm: "blake2b-256", body: { title: "no onChain" } },
      txHex,
    );
    expect(r.success).toBe(false);
  });
});
