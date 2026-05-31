/**
 * Verify a CIP-169 metadata document against a real Conway transaction.
 *
 * The library decodes the transaction itself via the Cardano Serialization
 * Library (CSL), strips self-referential anchors per CIP-169, and reports
 * either a match or a structured diff that points at the divergent path.
 *
 * Run: bun run docs/examples/cip169-verify-tx.ts
 *
 * In real usage you'd pass the CBOR hex of an on-chain transaction (e.g.
 * fetched via `cardano-cli query` or a Blockfrost-style API). For the example
 * we build one locally via CSL so the script is self-contained.
 */
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { cip169, resolve } from "../../src/index.js";

cip169.setCardanoSerializationLib(CSL);

// ─── Metadata document ──────────────────────────────────────
// This is what an off-chain governance document looks like with a body.onChain
// section that the library can compare against the on-chain transaction.
const RECIPIENT_STAKE_KEY_HASH = "22".repeat(28);

const recipientRewardAddress = CSL.RewardAddress.new(
  /* mainnet */ 1,
  CSL.Credential.from_keyhash(
    CSL.Ed25519KeyHash.from_hex(RECIPIENT_STAKE_KEY_HASH),
  ),
).to_address().to_bech32();

const PROPOSER_STAKE_KEY_HASH = "11".repeat(28);
const proposerRewardAddress = CSL.RewardAddress.new(
  1,
  CSL.Credential.from_keyhash(
    CSL.Ed25519KeyHash.from_hex(PROPOSER_STAKE_KEY_HASH),
  ),
).to_address().to_bech32();

const metadataDocument = {
  hashAlgorithm: "blake2b-256",
  body: {
    title: "Fund Development Team",
    abstract: "Withdraw 100k ADA to fund development",
    motivation: "Team has delivered milestones",
    rationale: "Funding will enable completion of the project",
    onChain: {
      deposit: "100000000000",
      reward_account: proposerRewardAddress,
      gov_action: {
        tag: "treasury_withdrawals_action",
        rewards: [
          {
            key: recipientRewardAddress,
            value: "100000000000000",
          },
        ],
      },
    },
  },
};

// ─── Build the on-chain transaction ─────────────────────────
function buildTreasuryWithdrawalTx(): string {
  const withdrawals = CSL.TreasuryWithdrawals.new();
  withdrawals.insert(
    CSL.RewardAddress.new(
      1,
      CSL.Credential.from_keyhash(
        CSL.Ed25519KeyHash.from_hex(RECIPIENT_STAKE_KEY_HASH),
      ),
    ),
    CSL.BigNum.from_str("100000000000000"),
  );

  const action = CSL.TreasuryWithdrawalsAction.new(withdrawals);
  const govAction = CSL.GovernanceAction.new_treasury_withdrawals_action(action);

  // The proposal carries a self-referential anchor (URL + hash of *this very*
  // metadata document); CIP-169 says verifiers strip it before comparing.
  const proposal = CSL.VotingProposal.new(
    govAction,
    CSL.Anchor.new(
      CSL.URL.new("ipfs://example-cid"),
      CSL.AnchorDataHash.from_hex("ab".repeat(32)),
    ),
    CSL.RewardAddress.new(
      1,
      CSL.Credential.from_keyhash(
        CSL.Ed25519KeyHash.from_hex(PROPOSER_STAKE_KEY_HASH),
      ),
    ),
    CSL.BigNum.from_str("100000000000"),
  );

  const proposals = CSL.VotingProposals.new();
  proposals.add(proposal);

  const inputs = CSL.TransactionInputs.new();
  inputs.add(
    CSL.TransactionInput.new(
      CSL.TransactionHash.from_hex("00".repeat(32)),
      0,
    ),
  );
  const outputs = CSL.TransactionOutputs.new();
  outputs.add(
    CSL.TransactionOutput.new(
      CSL.EnterpriseAddress.new(
        1,
        CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex("00".repeat(28))),
      ).to_address(),
      CSL.Value.new(CSL.BigNum.from_str("2000000")),
    ),
  );

  const body = CSL.TransactionBody.new_tx_body(
    inputs,
    outputs,
    CSL.BigNum.from_str("200000"),
  );
  body.set_voting_proposals(proposals);

  const tx = CSL.Transaction.new(
    body,
    CSL.TransactionWitnessSet.new(),
    undefined,
  );
  return tx.to_hex();
}

async function main(): Promise<void> {
  const txCborHex = buildTreasuryWithdrawalTx();
  const result = await cip169.verifyAgainstTx(metadataDocument, txCborHex);

  if (!result.success) {
    console.error(
      "Decode/setup failure:",
      result.error.code,
      result.error.message,
    );
    return;
  }

  if (result.data.matched) {
    console.log("MATCH — metadata is bound to this transaction.");
    console.log("  selector:", JSON.stringify(result.data.selectorUsed));
    return;
  }

  console.error("MISMATCH — possible metadata replay or wrong transaction.");
  for (const diff of result.data.differences) {
    console.error(
      `  ${diff.path}: ${JSON.stringify(diff.metadataValue)} ≠ ${JSON.stringify(
        diff.actionValue,
      )}`,
    );
  }
}

void main();

// You can also resolve metadata from a URI first, then verify:
export async function resolveThenVerify(
  uri: string,
  txCborHex: string,
): Promise<void> {
  const r = await resolve(uri);
  if (!r.success) return;
  if (!r.data.extensions.includes("CIP-169")) {
    console.log("metadata has no body.onChain — nothing to verify");
    return;
  }
  const v = await cip169.verifyAgainstTx(r.data.document, txCborHex);
  console.log(v);
}
