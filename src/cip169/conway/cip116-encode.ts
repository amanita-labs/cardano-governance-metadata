/**
 * Maps CSL-native objects → CIP-0116 JSON values.
 *
 * CSL's own `to_json()` is *close to* CIP-0116 but not identical:
 * - some BigNums emit as JSON numbers instead of decimal strings,
 * - credential objects use a discriminator shape that differs from CIP-0116's `{ tag, value }`,
 * - voter / governance-action discriminator names need normalising to snake_case CIP-116 tags.
 *
 * Each encoder accepts an opaque CSL handle (the lib was already validated by
 * `requireCsl()` upstream) and the CSL-native object, and returns plain JSON.
 */
import type {
	CertNoAnchor,
	Constitution,
	Credential,
	GovAction,
	GovActionId,
	ProposalProcedureNoAnchor,
	ProtocolVersion,
	Reward,
	UnitInterval,
	Voter,
	VotingProcedureNoAnchor,
	VotingProceduresNoAnchor,
} from "../types.js";
import { requireCsl } from "./csl-loader.js";

// biome-ignore lint/suspicious/noExplicitAny: see csl-loader.ts
type Csl = any;
// biome-ignore lint/suspicious/noExplicitAny: structural CSL value
type CslValue = any;

const CRED_KIND_KEY = 0;

const VOTER_KIND_CC_HOT = 0;
const VOTER_KIND_CC_HOT_SCRIPT = 1;
const VOTER_KIND_DREP = 2;
const VOTER_KIND_DREP_SCRIPT = 3;
const VOTER_KIND_POOL = 4;

const GOV_ACTION_KIND_PARAMETER_CHANGE = 0;
const GOV_ACTION_KIND_HARD_FORK = 1;
const GOV_ACTION_KIND_TREASURY_WITHDRAWALS = 2;
const GOV_ACTION_KIND_NO_CONFIDENCE = 3;
const GOV_ACTION_KIND_UPDATE_COMMITTEE = 4;
const GOV_ACTION_KIND_NEW_CONSTITUTION = 5;
const GOV_ACTION_KIND_INFO = 6;

const VOTE_KIND_NO = 0;
const VOTE_KIND_YES = 1;
const VOTE_KIND_ABSTAIN = 2;

export function encodeBigNum(bn: CslValue): string {
	return bn.to_str();
}

export function encodeCredential(cred: CslValue): Credential {
	if (cred.kind() === CRED_KIND_KEY) {
		const kh = cred.to_keyhash();
		return { tag: "pubkey_hash", value: kh.to_hex() };
	}
	const sh = cred.to_scripthash();
	return { tag: "script_hash", value: sh.to_hex() };
}

export function encodeRewardAddressBech32(rewardAddress: CslValue): string {
	return rewardAddress.to_address().to_bech32();
}

export function encodeProtocolVersion(pv: CslValue): ProtocolVersion {
	return { major: pv.major(), minor: pv.minor() };
}

export function encodeUnitInterval(ui: CslValue): UnitInterval {
	return {
		numerator: ui.numerator().to_str(),
		denominator: ui.denominator().to_str(),
	};
}

export function encodeGovActionId(id: CslValue): GovActionId {
	return {
		transaction_id: id.transaction_id().to_hex(),
		gov_action_index: id.index(),
	};
}

export function encodeAnchor(anchor: CslValue): {
	url: string;
	data_hash: string;
} {
	return {
		url: anchor.url().url(),
		data_hash: anchor.anchor_data_hash().to_hex(),
	};
}

export function encodeConstitution(constitution: CslValue): Constitution {
	const out: Constitution = {
		anchor: encodeAnchor(constitution.anchor()),
	};
	const sh = constitution.script_hash();
	if (sh) out.script_hash = sh.to_hex();
	return out;
}

export function encodeGovAction(govAction: CslValue): GovAction {
	const csl: Csl = requireCsl();
	void csl; // CSL is implicitly used through the methods on `govAction`.

	const kind = govAction.kind();

	switch (kind) {
		case GOV_ACTION_KIND_INFO:
			return { tag: "info_action" };

		case GOV_ACTION_KIND_PARAMETER_CHANGE: {
			const a = govAction.as_parameter_change_action();
			const id = a.gov_action_id();
			const ph = a.policy_hash();
			return {
				tag: "parameter_change_action",
				protocol_param_update: encodeProtocolParamUpdate(
					a.protocol_param_updates(),
				),
				...(id ? { gov_action_id: encodeGovActionId(id) } : {}),
				...(ph ? { policy_hash: ph.to_hex() } : {}),
			};
		}

		case GOV_ACTION_KIND_HARD_FORK: {
			const a = govAction.as_hard_fork_initiation_action();
			const id = a.gov_action_id();
			return {
				tag: "hard_fork_initiation_action",
				protocol_version: encodeProtocolVersion(a.protocol_version()),
				...(id ? { gov_action_id: encodeGovActionId(id) } : {}),
			};
		}

		case GOV_ACTION_KIND_TREASURY_WITHDRAWALS: {
			const a = govAction.as_treasury_withdrawals_action();
			const withdrawals = a.withdrawals();
			const keys = withdrawals.keys();
			const rewards: Reward[] = [];
			for (let i = 0; i < keys.len(); i++) {
				const addr = keys.get(i);
				const value = withdrawals.get(addr);
				if (!value) continue;
				rewards.push({
					key: encodeRewardAddressBech32(addr),
					value: encodeBigNum(value),
				});
			}
			const ph = a.policy_hash();
			return {
				tag: "treasury_withdrawals_action",
				rewards,
				...(ph ? { policy_hash: ph.to_hex() } : {}),
			};
		}

		case GOV_ACTION_KIND_NO_CONFIDENCE: {
			const a = govAction.as_no_confidence_action();
			const id = a.gov_action_id();
			return {
				tag: "no_confidence",
				...(id ? { gov_action_id: encodeGovActionId(id) } : {}),
			};
		}

		case GOV_ACTION_KIND_UPDATE_COMMITTEE: {
			const a = govAction.as_new_committee_action();
			const committee = a.committee();
			const memberKeys = committee.members_keys();
			const members = [];
			for (let i = 0; i < memberKeys.len(); i++) {
				const cred = memberKeys.get(i);
				const epoch = committee.get_member_epoch(cred);
				if (epoch === undefined) continue;
				members.push({
					key: encodeCredential(cred),
					value: String(epoch),
				});
			}
			const removeList = a.members_to_remove();
			const removed = [];
			for (let i = 0; i < removeList.len(); i++) {
				removed.push(encodeCredential(removeList.get(i)));
			}
			const id = a.gov_action_id();
			return {
				tag: "update_committee",
				committee: members,
				signature_threshold: encodeUnitInterval(committee.quorum_threshold()),
				...(removed.length ? { members_to_remove: removed } : {}),
				...(id ? { gov_action_id: encodeGovActionId(id) } : {}),
			};
		}

		case GOV_ACTION_KIND_NEW_CONSTITUTION: {
			const a = govAction.as_new_constitution_action();
			const id = a.gov_action_id();
			return {
				tag: "new_constitution",
				constitution: encodeConstitution(a.constitution()),
				...(id ? { gov_action_id: encodeGovActionId(id) } : {}),
			};
		}

		default:
			throw new Error(
				`Unknown GovernanceActionKind ${kind} — CIP-0169 does not define an encoding for this variant.`,
			);
	}
}

/**
 * The few `protocol_param_update` fields whose CSL `to_json()` name differs
 * from the CIP-116 (Conway) name. All other fields share the same name in
 * both vocabularies. Keyed by CSL name → CIP-116 name.
 */
const PPU_CSL_TO_CIP116: Readonly<Record<string, string>> = {
	min_committee_size: "committee_min_size",
	committee_term_limit: "committee_max_term_length",
	governance_action_validity_period: "gov_action_lifetime",
	governance_action_deposit: "gov_action_deposit",
	drep_inactivity_period: "drep_activity",
	ref_script_coins_per_byte: "min_fee_ref_script_cost_per_byte",
};

/**
 * Encode a CSL `ProtocolParamUpdate` into a CIP-116-shaped object.
 *
 * CSL's `to_json()` emits the *entire* struct with `null` for every unset
 * parameter and uses CSL's own field names, whereas CIP-116 metadata documents
 * carry only the parameters being changed, under CIP-116 names. We therefore:
 *
 * - drop unset (`null`) fields so the result is sparse like the metadata, and
 * - rename the handful of fields whose CSL name diverges from CIP-116
 *   ({@link PPU_CSL_TO_CIP116}).
 *
 * Nested values (intervals, ex-units, cost models, protocol version) are left
 * in CSL's `to_json()` shape — these match CIP-116 structurally, and
 * `compareOnChain` tolerates the number/decimal-string spelling of scalars.
 */
export function encodeProtocolParamUpdate(
	ppu: CslValue,
): Record<string, unknown> {
	const raw = cslToJson(ppu) as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (value === null || value === undefined) continue;
		out[PPU_CSL_TO_CIP116[key] ?? key] = value;
	}
	return out;
}

export function encodeVoter(voter: CslValue): Voter {
	switch (voter.kind()) {
		case VOTER_KIND_CC_HOT:
		case VOTER_KIND_CC_HOT_SCRIPT: {
			const cred = voter.to_constitutional_committee_hot_credential();
			if (!cred) throw new Error("CC voter is missing its hot credential");
			return { tag: "cc_credential", credential: encodeCredential(cred) };
		}
		case VOTER_KIND_DREP:
		case VOTER_KIND_DREP_SCRIPT: {
			const cred = voter.to_drep_credential();
			if (!cred) throw new Error("DRep voter is missing its credential");
			return { tag: "drep_credential", credential: encodeCredential(cred) };
		}
		case VOTER_KIND_POOL: {
			const kh = voter.to_stake_pool_key_hash();
			if (!kh) throw new Error("SPO voter is missing its key hash");
			return { tag: "spo_keyhash", pubkey_hash: kh.to_hex() };
		}
		default:
			throw new Error(`Unknown VoterKind ${voter.kind()}`);
	}
}

export function encodeVotingProcedureNoAnchor(
	procedure: CslValue,
): VotingProcedureNoAnchor {
	const voteKind = procedure.vote_kind();
	let vote: VotingProcedureNoAnchor["vote"];
	switch (voteKind) {
		case VOTE_KIND_YES:
			vote = "yes";
			break;
		case VOTE_KIND_NO:
			vote = "no";
			break;
		case VOTE_KIND_ABSTAIN:
			vote = "abstain";
			break;
		default:
			throw new Error(`Unknown VoteKind ${voteKind}`);
	}
	return { vote };
}

export function encodeVotingProceduresNoAnchor(
	votingProcedures: CslValue,
): VotingProceduresNoAnchor {
	const voters = votingProcedures.get_voters();
	const result: VotingProceduresNoAnchor = [];
	try {
		const votersLen = voters.len();
		for (let i = 0; i < votersLen; i++) {
			const voter = voters.get(i);
			if (!voter) continue;
			try {
				const ids = votingProcedures.get_governance_action_ids_by_voter(voter);
				try {
					const innerEntries: VotingProceduresNoAnchor[number]["value"] = [];
					const idsLen = ids.len();
					for (let j = 0; j < idsLen; j++) {
						const id = ids.get(j);
						if (!id) continue;
						try {
							const procedure = votingProcedures.get(voter, id);
							if (!procedure) continue;
							try {
								innerEntries.push({
									key: encodeGovActionId(id),
									value: encodeVotingProcedureNoAnchor(procedure),
								});
							} finally {
								procedure.free?.();
							}
						} finally {
							id.free?.();
						}
					}
					result.push({ key: encodeVoter(voter), value: innerEntries });
				} finally {
					ids.free?.();
				}
			} finally {
				voter.free?.();
			}
		}
	} finally {
		voters.free?.();
	}
	return result;
}

const CERT_KIND_COMMITTEE_COLD_RESIGN = 8;
const CERT_KIND_DREP_REGISTRATION = 10;
const CERT_KIND_DREP_UPDATE = 11;

/**
 * Encode a CSL `Certificate` into a CIP-169 no-anchor certificate value.
 * Returns `null` for certificate kinds not bound by CIP-0169 (only
 * register_drep / update_drep / resign_committee_cold are).
 */
export function encodeCertNoAnchor(cert: CslValue): CertNoAnchor | null {
	const handles: Array<{ free?: () => void }> = [];
	const track = <T extends { free?: () => void }>(h: T): T => {
		handles.push(h);
		return h;
	};
	try {
		switch (cert.kind()) {
			case CERT_KIND_DREP_REGISTRATION: {
				const c = track(cert.as_drep_registration());
				if (!c) return null;
				const cred = track(c.voting_credential());
				const coin = track(c.coin());
				return {
					tag: "register_drep",
					drep_credential: encodeCredential(cred),
					coin: coin.to_str(),
				};
			}
			case CERT_KIND_DREP_UPDATE: {
				const c = track(cert.as_drep_update());
				if (!c) return null;
				const cred = track(c.voting_credential());
				return {
					tag: "update_drep",
					drep_credential: encodeCredential(cred),
				};
			}
			case CERT_KIND_COMMITTEE_COLD_RESIGN: {
				const c = track(cert.as_committee_cold_resign());
				if (!c) return null;
				const cred = track(c.committee_cold_credential());
				return {
					tag: "resign_committee_cold",
					committee_cold_credential: encodeCredential(cred),
				};
			}
			default:
				return null;
		}
	} finally {
		for (let i = handles.length - 1; i >= 0; i--) {
			try {
				handles[i].free?.();
			} catch {
				// best-effort cleanup
			}
		}
	}
}

export function encodeProposalProcedureNoAnchor(
	proposal: CslValue,
): ProposalProcedureNoAnchor {
	return {
		deposit: encodeBigNum(proposal.deposit()),
		reward_account: encodeRewardAddressBech32(proposal.reward_account()),
		gov_action: encodeGovAction(proposal.governance_action()),
	};
}

function cslToJson(value: CslValue): unknown {
	return JSON.parse(value.to_json());
}
