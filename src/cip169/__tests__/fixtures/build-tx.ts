/**
 * Build Conway-era transaction CBOR fixtures using CSL.
 *
 * Tests import these helpers so each test gets a fresh tx without a giant hex
 * literal in the source. Mirrors what a real wallet/builder would emit.
 */
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";

const NETWORK_MAINNET = 1;
const ZERO_KEY_HASH = "00".repeat(28);

export function dummyTransactionInputs(): CSL.TransactionInputs {
  const inputs = CSL.TransactionInputs.new();
  inputs.add(
    CSL.TransactionInput.new(
      CSL.TransactionHash.from_hex("00".repeat(32)),
      0,
    ),
  );
  return inputs;
}

export function dummyTransactionOutputs(): CSL.TransactionOutputs {
  const outputs = CSL.TransactionOutputs.new();
  // EnterpriseAddress: zero key hash on mainnet — purely for fixture purposes.
  const enterpriseAddr = CSL.EnterpriseAddress.new(
    NETWORK_MAINNET,
    CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex(ZERO_KEY_HASH)),
  ).to_address();
  outputs.add(
    CSL.TransactionOutput.new(
      enterpriseAddr,
      CSL.Value.new(CSL.BigNum.from_str("2000000")),
    ),
  );
  return outputs;
}

export function makeRewardAddress(
  network: number = NETWORK_MAINNET,
  keyHashHex: string = ZERO_KEY_HASH,
): CSL.RewardAddress {
  return CSL.RewardAddress.new(
    network,
    CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex(keyHashHex)),
  );
}

export function makeAnchor(
  url: string = "https://example.com/metadata.jsonld",
  hashHex: string = "ab".repeat(32),
): CSL.Anchor {
  return CSL.Anchor.new(
    CSL.URL.new(url),
    CSL.AnchorDataHash.from_hex(hashHex),
  );
}

export interface TreasuryWithdrawalArgs {
  recipientStakeKeyHashHex: string;
  amountLovelace: string;
  deposit?: string;
  network?: number;
}

export function buildTreasuryWithdrawalTx(
  args: TreasuryWithdrawalArgs,
): { txHex: string; tx: CSL.Transaction } {
  const network = args.network ?? NETWORK_MAINNET;
  const recipient = makeRewardAddress(network, args.recipientStakeKeyHashHex);

  const withdrawals = CSL.TreasuryWithdrawals.new();
  withdrawals.insert(recipient, CSL.BigNum.from_str(args.amountLovelace));
  const action = CSL.TreasuryWithdrawalsAction.new(withdrawals);
  const govAction = CSL.GovernanceAction.new_treasury_withdrawals_action(action);

  const proposalRewardAccount = makeRewardAddress(network, "11".repeat(28));
  const proposal = CSL.VotingProposal.new(
    govAction,
    makeAnchor(),
    proposalRewardAccount,
    CSL.BigNum.from_str(args.deposit ?? "100000000000"),
  );

  const proposals = CSL.VotingProposals.new();
  proposals.add(proposal);

  const body = CSL.TransactionBody.new_tx_body(
    dummyTransactionInputs(),
    dummyTransactionOutputs(),
    CSL.BigNum.from_str("200000"),
  );
  body.set_voting_proposals(proposals);

  const tx = CSL.Transaction.new(
    body,
    CSL.TransactionWitnessSet.new(),
    undefined,
  );
  const txHex = tx.to_hex();
  return { txHex, tx };
}

export interface DrepRegistrationArgs {
  drepKeyHashHex: string;
  coin: string;
}

export function buildDrepRegistrationTx(
  args: DrepRegistrationArgs,
): { txHex: string; tx: CSL.Transaction } {
  const cred = CSL.Credential.from_keyhash(
    CSL.Ed25519KeyHash.from_hex(args.drepKeyHashHex),
  );
  const reg = CSL.DRepRegistration.new(cred, CSL.BigNum.from_str(args.coin));
  const cert = CSL.Certificate.new_drep_registration(reg);

  const certs = CSL.Certificates.new();
  certs.add(cert);

  const body = CSL.TransactionBody.new_tx_body(
    dummyTransactionInputs(),
    dummyTransactionOutputs(),
    CSL.BigNum.from_str("200000"),
  );
  body.set_certs(certs);

  const tx = CSL.Transaction.new(
    body,
    CSL.TransactionWitnessSet.new(),
    undefined,
  );
  return { txHex: tx.to_hex(), tx };
}
