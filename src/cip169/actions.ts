import type {
	CertNoAnchor,
	CommitteeMember,
	Constitution,
	Credential,
	GovAction,
	GovActionId,
	ProtocolParamUpdate,
	ProtocolVersion,
	RegisterDrepNoAnchor,
	ResignCommitteeColdNoAnchor,
	Reward,
	UnitInterval,
	UpdateDrepNoAnchor,
	VotingProceduresNoAnchor,
} from "./types.js";

/**
 * Per-action factory helpers for CIP-169 on-chain effects. Each helper is a
 * pure type-narrowed constructor — there is no runtime validation here.
 * Documents containing the result are validated end-to-end by `cip169.build`
 * (or by any `cipNNN.build` that nests the value under `body.onChain`).
 */

// ─── Governance actions ─────────────────────────────────────────────────────

type InfoAction = Extract<GovAction, { tag: "info_action" }>;
type ParameterChange = Extract<GovAction, { tag: "parameter_change_action" }>;
type HardForkInitiation = Extract<
	GovAction,
	{ tag: "hard_fork_initiation_action" }
>;
type TreasuryWithdrawals = Extract<
	GovAction,
	{ tag: "treasury_withdrawals_action" }
>;
type NoConfidence = Extract<GovAction, { tag: "no_confidence" }>;
type UpdateCommittee = Extract<GovAction, { tag: "update_committee" }>;
type NewConstitution = Extract<GovAction, { tag: "new_constitution" }>;

export function infoAction(input?: {
	gov_action_id?: GovActionId;
}): InfoAction {
	return input?.gov_action_id
		? { tag: "info_action", gov_action_id: input.gov_action_id }
		: { tag: "info_action" };
}

export function parameterChange(input: {
	gov_action_id?: GovActionId;
	protocol_param_update: ProtocolParamUpdate;
	policy_hash?: string;
}): ParameterChange {
	return { tag: "parameter_change_action", ...input };
}

export function hardForkInitiation(input: {
	gov_action_id?: GovActionId;
	protocol_version: ProtocolVersion;
}): HardForkInitiation {
	return { tag: "hard_fork_initiation_action", ...input };
}

export function treasuryWithdrawals(input?: {
	rewards?: Reward[];
	policy_hash?: string;
}): TreasuryWithdrawals {
	return { tag: "treasury_withdrawals_action", ...(input ?? {}) };
}

export function noConfidence(input?: {
	gov_action_id?: GovActionId;
}): NoConfidence {
	return input?.gov_action_id
		? { tag: "no_confidence", gov_action_id: input.gov_action_id }
		: { tag: "no_confidence" };
}

export function updateCommittee(input: {
	gov_action_id?: GovActionId;
	members_to_remove?: Credential[];
	committee: CommitteeMember[];
	signature_threshold: UnitInterval;
}): UpdateCommittee {
	return { tag: "update_committee", ...input };
}

export function newConstitution(input: {
	gov_action_id?: GovActionId;
	constitution: Constitution;
}): NewConstitution {
	return { tag: "new_constitution", ...input };
}

// ─── Certificates (no-anchor) ───────────────────────────────────────────────

export function registerDrep(input: {
	drep_credential: Credential;
	coin: string;
}): RegisterDrepNoAnchor {
	return { tag: "register_drep", ...input };
}

export function updateDrep(input: {
	drep_credential: Credential;
}): UpdateDrepNoAnchor {
	return { tag: "update_drep", ...input };
}

export function resignCommitteeCold(input: {
	committee_cold_credential: Credential;
}): ResignCommitteeColdNoAnchor {
	return { tag: "resign_committee_cold", ...input };
}

// ─── Voting procedures ──────────────────────────────────────────────────────

/**
 * Identity helper — wraps the caller's `VotingProceduresNoAnchor` value so
 * its type is locked in at the construction site. Useful for IDE discovery
 * even though there is no transformation.
 */
export function votingProcedures(
	input: VotingProceduresNoAnchor,
): VotingProceduresNoAnchor {
	return input;
}

// ─── Certificate union helper ───────────────────────────────────────────────

export type { CertNoAnchor };
