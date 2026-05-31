export type GovActionTag =
	| "info_action"
	| "parameter_change_action"
	| "hard_fork_initiation_action"
	| "treasury_withdrawals_action"
	| "no_confidence"
	| "update_committee"
	| "new_constitution";

export type CertNoAnchorTag =
	| "register_drep"
	| "update_drep"
	| "resign_committee_cold";

export interface Credential {
	tag: "pubkey_hash" | "script_hash";
	value: string;
}

export interface GovActionId {
	transaction_id: string;
	/**
	 * Per CIP-116 this is a uint. Metadata authors may also serialize it as
	 * a numeric string for backwards-compat; `compareOnChain` normalizes both
	 * sides before comparison.
	 */
	gov_action_index: number | string;
}

export interface ProtocolVersion {
	major: number;
	minor: number;
}

export interface UnitInterval {
	numerator: string | number;
	denominator: string | number;
}

export interface Reward {
	key: string;
	value: string;
}

export interface CommitteeMember {
	key: Credential;
	value: string | number;
}

export interface Constitution {
	anchor?: { url: string; data_hash: string } | unknown;
	script_hash?: string;
}

export type ProtocolParamUpdate = Record<string, unknown>;

export type GovAction =
	| { tag: "info_action"; gov_action_id?: GovActionId }
	| {
			tag: "parameter_change_action";
			gov_action_id?: GovActionId;
			protocol_param_update: ProtocolParamUpdate;
			policy_hash?: string;
	  }
	| {
			tag: "hard_fork_initiation_action";
			gov_action_id?: GovActionId;
			protocol_version: ProtocolVersion;
	  }
	| {
			tag: "treasury_withdrawals_action";
			rewards?: Reward[];
			policy_hash?: string;
	  }
	| { tag: "no_confidence"; gov_action_id?: GovActionId }
	| {
			tag: "update_committee";
			gov_action_id?: GovActionId;
			members_to_remove?: Credential[];
			committee: CommitteeMember[];
			signature_threshold: UnitInterval;
	  }
	| {
			tag: "new_constitution";
			gov_action_id?: GovActionId;
			constitution: Constitution;
	  };

export interface ProposalProcedureNoAnchor {
	deposit: string;
	reward_account: string;
	gov_action: GovAction;
}

export type VoterTag =
	| "constitutional_committee_hot_credential"
	| "drep_credential"
	| "staking_pool_key_hash";

export interface Voter {
	tag: VoterTag;
	credential?: Credential;
	key_hash?: string;
	pubkey_hash?: string;
}

export type Vote = "yes" | "no" | "abstain";

export interface VotingProcedureNoAnchor {
	vote: Vote;
}

export type VotingProceduresNoAnchor = Array<{
	key: Voter;
	value: Array<{ key: GovActionId; value: VotingProcedureNoAnchor }>;
}>;

export interface RegisterDrepNoAnchor {
	tag: "register_drep";
	drep_credential: Credential;
	coin: string;
}

export interface UpdateDrepNoAnchor {
	tag: "update_drep";
	drep_credential: Credential;
}

export interface ResignCommitteeColdNoAnchor {
	tag: "resign_committee_cold";
	committee_cold_credential: Credential;
}

export type CertNoAnchor =
	| RegisterDrepNoAnchor
	| UpdateDrepNoAnchor
	| ResignCommitteeColdNoAnchor;

export type OnChain =
	| ProposalProcedureNoAnchor
	| VotingProceduresNoAnchor
	| CertNoAnchor;

export interface OnChainDifference {
	path: string;
	metadataValue: unknown;
	actionValue: unknown;
}

export interface OnChainCompareResult {
	equal: boolean;
	differences: OnChainDifference[];
}

export type Selector =
	| { kind: "proposalProcedure"; index?: number }
	| { kind: "certificate"; index?: number }
	| { kind: "votingProcedures" };

export interface DecodedConwayTx {
	proposalProcedures: ProposalProcedureNoAnchor[];
	certificates: CertNoAnchor[];
	votingProcedures: VotingProceduresNoAnchor | null;
	skipped: Array<{ kind: "certificate" | "proposal"; reason: string }>;
}

export interface VerifyAgainstTxMatched {
	matched: true;
	selectorUsed: Selector;
}

export interface VerifyAgainstTxMismatched {
	matched: false;
	differences: OnChainDifference[];
	selectorUsed: Selector;
}

export type VerifyAgainstTxResult =
	| VerifyAgainstTxMatched
	| VerifyAgainstTxMismatched;
