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
		CSL.TransactionInput.new(CSL.TransactionHash.from_hex("00".repeat(32)), 0),
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
	url = "https://example.com/metadata.jsonld",
	hashHex: string = "ab".repeat(32),
): CSL.Anchor {
	return CSL.Anchor.new(CSL.URL.new(url), CSL.AnchorDataHash.from_hex(hashHex));
}

export interface TreasuryWithdrawalArgs {
	recipientStakeKeyHashHex: string;
	amountLovelace: string;
	deposit?: string;
	network?: number;
}

export function buildTreasuryWithdrawalTx(args: TreasuryWithdrawalArgs): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const network = args.network ?? NETWORK_MAINNET;
	const recipient = makeRewardAddress(network, args.recipientStakeKeyHashHex);

	const withdrawals = CSL.TreasuryWithdrawals.new();
	withdrawals.insert(recipient, CSL.BigNum.from_str(args.amountLovelace));
	const action = CSL.TreasuryWithdrawalsAction.new(withdrawals);
	const govAction =
		CSL.GovernanceAction.new_treasury_withdrawals_action(action);

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

export function buildDrepRegistrationTx(args: DrepRegistrationArgs): {
	txHex: string;
	tx: CSL.Transaction;
} {
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

export function buildDrepUpdateTx(drepKeyHashHex: string): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const cred = CSL.Credential.from_keyhash(
		CSL.Ed25519KeyHash.from_hex(drepKeyHashHex),
	);
	const upd = CSL.DRepUpdate.new(cred);
	const cert = CSL.Certificate.new_drep_update(upd);

	const certs = CSL.Certificates.new();
	certs.add(cert);

	const body = CSL.TransactionBody.new_tx_body(
		dummyTransactionInputs(),
		dummyTransactionOutputs(),
		CSL.BigNum.from_str("200000"),
	);
	body.set_certs(certs);

	return wrapTx(body);
}

export function buildResignCommitteeColdTx(ccColdScriptHashHex: string): {
	txHex: string;
	tx: CSL.Transaction;
} {
	// script_hash variant exercises the encodeCredential `script_hash` branch.
	const cred = CSL.Credential.from_scripthash(
		CSL.ScriptHash.from_hex(ccColdScriptHashHex),
	);
	const r = CSL.CommitteeColdResign.new(cred);
	const cert = CSL.Certificate.new_committee_cold_resign(r);

	const certs = CSL.Certificates.new();
	certs.add(cert);

	const body = CSL.TransactionBody.new_tx_body(
		dummyTransactionInputs(),
		dummyTransactionOutputs(),
		CSL.BigNum.from_str("200000"),
	);
	body.set_certs(certs);
	return wrapTx(body);
}

export function buildInfoActionTx(): { txHex: string; tx: CSL.Transaction } {
	const action = CSL.InfoAction.new();
	const govAction = CSL.GovernanceAction.new_info_action(action);
	return wrapTxWithProposal(govAction);
}

export function buildHardForkActionTx(
	major: number,
	minor: number,
): { txHex: string; tx: CSL.Transaction } {
	const pv = CSL.ProtocolVersion.new(major, minor);
	const action = CSL.HardForkInitiationAction.new(pv);
	const govAction =
		CSL.GovernanceAction.new_hard_fork_initiation_action(action);
	return wrapTxWithProposal(govAction);
}

export function buildNoConfidenceActionTx(): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const action = CSL.NoConfidenceAction.new();
	const govAction = CSL.GovernanceAction.new_no_confidence_action(action);
	return wrapTxWithProposal(govAction);
}

export function buildNewConstitutionActionTx(
	constitutionUrl = "https://example.com/constitution.txt",
	constitutionHashHex: string = "cd".repeat(32),
): { txHex: string; tx: CSL.Transaction } {
	const constitution = CSL.Constitution.new(
		CSL.Anchor.new(
			CSL.URL.new(constitutionUrl),
			CSL.AnchorDataHash.from_hex(constitutionHashHex),
		),
	);
	const action = CSL.NewConstitutionAction.new(constitution);
	const govAction = CSL.GovernanceAction.new_new_constitution_action(action);
	return wrapTxWithProposal(govAction);
}

export function buildVotingProcedureTx(args: {
	drepKeyHashHex: string;
	vote: "yes" | "no" | "abstain";
	govActionTxIdHex: string;
	govActionIndex: number;
}): { txHex: string; tx: CSL.Transaction } {
	const voter = CSL.Voter.new_drep_credential(
		CSL.Credential.from_keyhash(
			CSL.Ed25519KeyHash.from_hex(args.drepKeyHashHex),
		),
	);
	const govActionId = CSL.GovernanceActionId.new(
		CSL.TransactionHash.from_hex(args.govActionTxIdHex),
		args.govActionIndex,
	);
	const voteKind =
		args.vote === "yes"
			? CSL.VoteKind.Yes
			: args.vote === "no"
				? CSL.VoteKind.No
				: CSL.VoteKind.Abstain;
	const procedure = CSL.VotingProcedure.new(voteKind);

	const procs = CSL.VotingProcedures.new();
	procs.insert(voter, govActionId, procedure);

	const body = CSL.TransactionBody.new_tx_body(
		dummyTransactionInputs(),
		dummyTransactionOutputs(),
		CSL.BigNum.from_str("200000"),
	);
	body.set_voting_procedures(procs);
	return wrapTx(body);
}

export function buildParameterChangeActionTx(): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const upd = CSL.ProtocolParamUpdate.new();
	upd.set_minfee_a(CSL.BigNum.from_str("44"));
	upd.set_minfee_b(CSL.BigNum.from_str("155381"));
	const action = CSL.ParameterChangeAction.new(upd);
	const govAction = CSL.GovernanceAction.new_parameter_change_action(action);
	return wrapTxWithProposal(govAction);
}

/**
 * A parameter_change action that sets every protocol-param field whose CSL
 * `to_json()` name diverges from its CIP-116 name. Used to verify the
 * CSL→CIP-116 rename table in the encoder.
 */
export function buildDivergentParamChangeActionTx(): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const upd = CSL.ProtocolParamUpdate.new();
	upd.set_min_committee_size(5);
	upd.set_committee_term_limit(146);
	upd.set_governance_action_validity_period(30);
	upd.set_governance_action_deposit(CSL.BigNum.from_str("100000000000"));
	upd.set_drep_inactivity_period(20);
	upd.set_ref_script_coins_per_byte(
		CSL.UnitInterval.new(CSL.BigNum.from_str("15"), CSL.BigNum.from_str("1")),
	);
	const action = CSL.ParameterChangeAction.new(upd);
	const govAction = CSL.GovernanceAction.new_parameter_change_action(action);
	return wrapTxWithProposal(govAction);
}

export function buildUpdateCommitteeActionTx(): {
	txHex: string;
	tx: CSL.Transaction;
} {
	// Members to remove (script_hash flavour to also exercise that branch)
	const removeMembers = CSL.Credentials.new();
	removeMembers.add(
		CSL.Credential.from_scripthash(CSL.ScriptHash.from_hex("aa".repeat(28))),
	);

	// Members to add — Committee starts with quorum threshold and we register members on top.
	const quorum = CSL.UnitInterval.new(
		CSL.BigNum.from_str("2"),
		CSL.BigNum.from_str("3"),
	);
	const committee = CSL.Committee.new(quorum);
	committee.add_member(
		CSL.Credential.from_keyhash(CSL.Ed25519KeyHash.from_hex("bb".repeat(28))),
		100,
	);
	const action = CSL.UpdateCommitteeAction.new(committee, removeMembers);
	const govAction = CSL.GovernanceAction.new_new_committee_action(action);
	return wrapTxWithProposal(govAction);
}

export function buildVotingProcedureFromPoolTx(args: {
	poolKeyHashHex: string;
	vote: "yes" | "no" | "abstain";
	govActionTxIdHex: string;
	govActionIndex: number;
}): { txHex: string; tx: CSL.Transaction } {
	const voter = CSL.Voter.new_stake_pool_key_hash(
		CSL.Ed25519KeyHash.from_hex(args.poolKeyHashHex),
	);
	const govActionId = CSL.GovernanceActionId.new(
		CSL.TransactionHash.from_hex(args.govActionTxIdHex),
		args.govActionIndex,
	);
	const voteKind =
		args.vote === "yes"
			? CSL.VoteKind.Yes
			: args.vote === "no"
				? CSL.VoteKind.No
				: CSL.VoteKind.Abstain;
	const procedure = CSL.VotingProcedure.new(voteKind);
	const procs = CSL.VotingProcedures.new();
	procs.insert(voter, govActionId, procedure);
	const body = CSL.TransactionBody.new_tx_body(
		dummyTransactionInputs(),
		dummyTransactionOutputs(),
		CSL.BigNum.from_str("200000"),
	);
	body.set_voting_procedures(procs);
	return wrapTx(body);
}

export function buildVotingProcedureFromCcHotTx(args: {
	ccHotKeyHashHex: string;
	vote: "yes" | "no" | "abstain";
	govActionTxIdHex: string;
	govActionIndex: number;
}): { txHex: string; tx: CSL.Transaction } {
	const voter = CSL.Voter.new_constitutional_committee_hot_credential(
		CSL.Credential.from_keyhash(
			CSL.Ed25519KeyHash.from_hex(args.ccHotKeyHashHex),
		),
	);
	const govActionId = CSL.GovernanceActionId.new(
		CSL.TransactionHash.from_hex(args.govActionTxIdHex),
		args.govActionIndex,
	);
	const voteKind =
		args.vote === "yes"
			? CSL.VoteKind.Yes
			: args.vote === "no"
				? CSL.VoteKind.No
				: CSL.VoteKind.Abstain;
	const procedure = CSL.VotingProcedure.new(voteKind);
	const procs = CSL.VotingProcedures.new();
	procs.insert(voter, govActionId, procedure);
	const body = CSL.TransactionBody.new_tx_body(
		dummyTransactionInputs(),
		dummyTransactionOutputs(),
		CSL.BigNum.from_str("200000"),
	);
	body.set_voting_procedures(procs);
	return wrapTx(body);
}

function wrapTxWithProposal(govAction: CSL.GovernanceAction): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const proposalRewardAccount = makeRewardAddress(
		NETWORK_MAINNET,
		"11".repeat(28),
	);
	const proposal = CSL.VotingProposal.new(
		govAction,
		makeAnchor(),
		proposalRewardAccount,
		CSL.BigNum.from_str("100000000000"),
	);
	const proposals = CSL.VotingProposals.new();
	proposals.add(proposal);

	const body = CSL.TransactionBody.new_tx_body(
		dummyTransactionInputs(),
		dummyTransactionOutputs(),
		CSL.BigNum.from_str("200000"),
	);
	body.set_voting_proposals(proposals);
	return wrapTx(body);
}

function wrapTx(body: CSL.TransactionBody): {
	txHex: string;
	tx: CSL.Transaction;
} {
	const tx = CSL.Transaction.new(
		body,
		CSL.TransactionWitnessSet.new(),
		undefined,
	);
	return { txHex: tx.to_hex(), tx };
}
