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
  Constitution,
  Credential,
  GovAction,
  GovActionId,
  ProposalProcedureNoAnchor,
  ProtocolVersion,
  Reward,
  UnitInterval,
  Voter,
  VotingProceduresNoAnchor,
  VotingProcedureNoAnchor,
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
    gov_action_index: String(id.index()),
  };
}

export function encodeAnchor(anchor: CslValue): { url: string; data_hash: string } {
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
        protocol_param_update: cslToJson(a.protocol_param_update()) as Record<
          string,
          unknown
        >,
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

export function encodeVoter(voter: CslValue): Voter {
  switch (voter.kind()) {
    case VOTER_KIND_CC_HOT: {
      const cred = voter.to_constitutional_committee_hot_credential();
      return {
        tag: "constitutional_committee_hot_credential",
        credential: cred ? encodeCredential(cred) : undefined,
      };
    }
    case VOTER_KIND_CC_HOT_SCRIPT: {
      const cred = voter.to_constitutional_committee_hot_credential();
      return {
        tag: "constitutional_committee_hot_credential",
        credential: cred ? encodeCredential(cred) : undefined,
      };
    }
    case VOTER_KIND_DREP: {
      const cred = voter.to_drep_credential();
      return {
        tag: "drep_credential",
        credential: cred ? encodeCredential(cred) : undefined,
      };
    }
    case VOTER_KIND_DREP_SCRIPT: {
      const cred = voter.to_drep_credential();
      return {
        tag: "drep_credential",
        credential: cred ? encodeCredential(cred) : undefined,
      };
    }
    case VOTER_KIND_POOL: {
      const kh = voter.to_stake_pool_key_hash();
      return {
        tag: "staking_pool_key_hash",
        key_hash: kh ? kh.to_hex() : undefined,
      };
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
    case VOTE_KIND_YES: vote = "yes"; break;
    case VOTE_KIND_NO: vote = "no"; break;
    case VOTE_KIND_ABSTAIN: vote = "abstain"; break;
    default: throw new Error(`Unknown VoteKind ${voteKind}`);
  }
  return { vote };
}

export function encodeVotingProceduresNoAnchor(
  votingProcedures: CslValue,
): VotingProceduresNoAnchor {
  const voters = votingProcedures.get_voters();
  const result: VotingProceduresNoAnchor = [];
  for (let i = 0; i < voters.len(); i++) {
    const voter = voters.get(i);
    if (!voter) continue;
    const ids = votingProcedures.get_governance_action_ids_by_voter(voter);
    const innerEntries: VotingProceduresNoAnchor[number]["value"] = [];
    for (let j = 0; j < ids.len(); j++) {
      const id = ids.get(j);
      if (!id) continue;
      const procedure = votingProcedures.get(voter, id);
      if (!procedure) continue;
      innerEntries.push({
        key: encodeGovActionId(id),
        value: encodeVotingProcedureNoAnchor(procedure),
      });
    }
    result.push({ key: encodeVoter(voter), value: innerEntries });
  }
  return result;
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
