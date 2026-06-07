import { cip169 } from "./lib";

/**
 * Lazily load the Cardano Serialization Library (browser WASM build) and
 * register it with the library's CIP-169 module. Required before any
 * `cip169.decodeConwayTx` / `cip169.verifyAgainstTx` call.
 *
 * Dynamic import keeps the multi-MB WASM payload off the initial page load —
 * it's only fetched/instantiated the first time the On-Chain tab needs it.
 * Because there is exactly one library `dist`, the module-level CSL singleton
 * set here is the same instance the verify/decode functions read from.
 */
type CSLModule = typeof import("@emurgo/cardano-serialization-lib-browser");

let initPromise: Promise<CSLModule> | null = null;

export function initCsl(): Promise<CSLModule> {
  if (!initPromise) {
    initPromise = (async () => {
      const CSL = await import("@emurgo/cardano-serialization-lib-browser");
      // The whole module namespace IS the CSL handle the library duck-types on.
      cip169.setCardanoSerializationLib(CSL);
      return CSL;
    })();
  }
  return initPromise;
}

export function isCslReady(): boolean {
  return cip169.getCardanoSerializationLib() !== undefined;
}

/**
 * The library's public surface decodes full Conway transactions, not bare
 * proposal procedures. Real `.action` fixtures (and most "governance action"
 * exports) are bare `VotingProposal` CBOR, so if the input isn't already a
 * transaction we wrap it in a minimal Conway tx body — mirroring the helper in
 * the library's own real-fixtures test.
 */
export async function toTransactionHex(cborHex: string): Promise<string> {
  const CSL = await initCsl();
  const hex = cborHex.trim();
  try {
    CSL.Transaction.from_hex(hex);
    return hex; // already a full transaction
  } catch {
    // fall through: treat as a bare VotingProposal
  }

  const proposal = CSL.VotingProposal.from_hex(hex);
  const proposals = CSL.VotingProposals.new();
  proposals.add(proposal);

  const inputs = CSL.TransactionInputs.new();
  inputs.add(
    CSL.TransactionInput.new(CSL.TransactionHash.from_hex("00".repeat(32)), 0),
  );
  const outputs = CSL.TransactionOutputs.new();
  outputs.add(
    CSL.TransactionOutput.new(
      CSL.EnterpriseAddress.new(
        1,
        CSL.Credential.from_keyhash(
          CSL.Ed25519KeyHash.from_hex("00".repeat(28)),
        ),
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
