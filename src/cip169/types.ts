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

export interface Anchor {
	url: string;
	data_hash: string;
}

/**
 * Per CIP-116, `anchor` is required — it points to the constitution document
 * itself (not this metadata), so it is retained: the one exception to
 * CIP-0169's anchor-omission rule.
 */
export interface Constitution {
	anchor: Anchor;
	script_hash?: string;
}

export type ProtocolParamUpdate = Record<string, unknown>;

export type GovAction =
	| { tag: "info_action" }
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

export type VoterTag = "cc_credential" | "drep_credential" | "spo_keyhash";

/**
 * CIP-116 Voter: credential voters carry `credential`; SPO voters carry
 * `pubkey_hash` under the `spo_keyhash` tag.
 */
export type Voter =
	| { tag: "cc_credential"; credential: Credential }
	| { tag: "drep_credential"; credential: Credential }
	| { tag: "spo_keyhash"; pubkey_hash: string };

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

export type GovEnvelopeKind =
	| "proposalProcedure"
	| "votingProcedures"
	| "certificate";

export interface DecodedGovEnvelope {
	kind: GovEnvelopeKind;
	onChain: OnChain;
	/**
	 * Metadata anchors found on the decoded value — the ones CIP-0169 omits
	 * from `body.onChain` because they point at the metadata document itself:
	 * the proposal/certificate anchor, or each inner voting-procedure anchor.
	 * Use these to check the on-chain `data_hash` against the metadata file's
	 * blake2b-256 hash.
	 */
	anchors: Anchor[];
}

export interface VerifyAgainstEnvelopeMatched {
	matched: true;
	kind: GovEnvelopeKind;
	anchors: Anchor[];
}

export interface VerifyAgainstEnvelopeMismatched {
	matched: false;
	kind: GovEnvelopeKind;
	anchors: Anchor[];
	differences: OnChainDifference[];
}

export type VerifyAgainstEnvelopeResult =
	| VerifyAgainstEnvelopeMatched
	| VerifyAgainstEnvelopeMismatched;
