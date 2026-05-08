/**
 * Verify a CIP-169 metadata document against a real Conway transaction.
 *
 * The library decodes the transaction itself via the Cardano Serialization
 * Library (CSL), strips self-referential anchors per CIP-169, and reports
 * either a match or a structured diff that points at the divergent path.
 *
 * Run: bun run docs/examples/cip169-verify-tx.ts
 */
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { resolve, cip169 } from "../../src/index.js";

cip169.setCardanoSerializationLib(CSL);

const TREASURY_WITHDRAWAL = {
  hashAlgorithm: "blake2b-256",
  body: {
    title: "Fund Project",
    abstract: "Withdraw funds for project work",
    motivation: "Project needs funds",
    rationale: "We delivered milestones",
    onChain: {
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
    },
  },
};

// The hex below is a real Conway tx your wallet would emit; pasted here for the
// example. Replace with your own when running against on-chain data.
const TX_CBOR_HEX = "84a300818258200000000000000000000000000000000000000000000000000000000000000000000182825839... <truncated>";

async function main(): Promise<void> {
  const result = await cip169.verifyAgainstTx(TREASURY_WITHDRAWAL, TX_CBOR_HEX);

  if (!result.success) {
    console.error("Decode/setup failure:", result.error.code, result.error.message);
    return;
  }
  if (result.data.matched) {
    console.log("MATCH — metadata is bound to this transaction.");
    console.log("  selector:", result.data.selectorUsed);
    return;
  }
  console.error("MISMATCH — possible metadata replay or wrong transaction.");
  for (const diff of result.data.differences) {
    console.error(`  ${diff.path}: ${JSON.stringify(diff.metadataValue)} ≠ ${JSON.stringify(diff.actionValue)}`);
  }
}

void main();

// You can also resolve metadata from a URI first, then verify:
async function resolveThenVerify(uri: string, txCbor: string): Promise<void> {
  const r = await resolve(uri);
  if (!r.success) return;
  if (!r.data.extensions.includes("CIP-169")) {
    console.log("metadata has no body.onChain — nothing to verify");
    return;
  }
  const v = await cip169.verifyAgainstTx(r.data.document, txCbor);
  console.log(v);
}

void resolveThenVerify;
