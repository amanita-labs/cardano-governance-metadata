import { z } from "zod";

/**
 * CIP-0169 `onChain` schemas.
 *
 * Mirrors the spec's `cip-0169.common.schema.json`, which sets
 * `unevaluatedProperties: false` on every object — hence `.strict()`
 * throughout. This is what rejects a self-referential `anchor` smuggled
 * into any variant (the spec's `forbidden-anchor` negative vector).
 * Forward-compat for future CIP-116 fields is provided by the context's
 * `@vocab`, not by schema leniency.
 */

const CoinSchema = z.string().regex(/^\d+$/);

const CredentialSchema = z
	.object({
		tag: z.enum(["pubkey_hash", "script_hash"]),
		value: z.string(),
	})
	.strict();

const RewardAccountSchema = z.string();

const GovActionIdSchema = z
	.object({
		transaction_id: z.string(),
		gov_action_index: z.union([z.string(), z.number()]),
	})
	.strict();

const ProtocolVersionSchema = z
	.object({
		major: z.number(),
		minor: z.number(),
	})
	.strict();

const UnitIntervalSchema = z
	.object({
		numerator: z.union([z.string(), z.number()]),
		denominator: z.union([z.string(), z.number()]),
	})
	.strict();

const RewardSchema = z
	.object({
		key: RewardAccountSchema,
		value: CoinSchema,
	})
	.strict();

const CommitteeMemberSchema = z
	.object({
		key: CredentialSchema,
		value: z.union([z.string(), z.number()]),
	})
	.strict();

const AnchorSchema = z
	.object({
		url: z.string(),
		data_hash: z.string(),
	})
	.strict();

// CIP-116 Constitution requires `anchor` — it points to the constitution
// document itself, not to this metadata, so it is retained (the one
// exception to CIP-0169's anchor-omission rule).
const ConstitutionSchema = z
	.object({
		anchor: AnchorSchema,
		script_hash: z.string().optional(),
	})
	.strict();

/**
 * Deliberately lenient: the spec `$ref`s the full CIP-116
 * `ProtocolParamUpdate`; enumerating its ~30 fields here is out of scope.
 */
const ProtocolParamUpdateSchema = z.record(z.unknown());

const GovActionSchema = z.discriminatedUnion("tag", [
	z
		.object({
			tag: z.literal("info_action"),
		})
		.strict(),
	z
		.object({
			tag: z.literal("parameter_change_action"),
			gov_action_id: GovActionIdSchema.optional(),
			protocol_param_update: ProtocolParamUpdateSchema,
			policy_hash: z.string().optional(),
		})
		.strict(),
	z
		.object({
			tag: z.literal("hard_fork_initiation_action"),
			gov_action_id: GovActionIdSchema.optional(),
			protocol_version: ProtocolVersionSchema,
		})
		.strict(),
	z
		.object({
			tag: z.literal("treasury_withdrawals_action"),
			rewards: z.array(RewardSchema).optional(),
			policy_hash: z.string().optional(),
		})
		.strict(),
	z
		.object({
			tag: z.literal("no_confidence"),
			gov_action_id: GovActionIdSchema.optional(),
		})
		.strict(),
	z
		.object({
			tag: z.literal("update_committee"),
			gov_action_id: GovActionIdSchema.optional(),
			members_to_remove: z.array(CredentialSchema).optional(),
			committee: z.array(CommitteeMemberSchema),
			signature_threshold: UnitIntervalSchema,
		})
		.strict(),
	z
		.object({
			tag: z.literal("new_constitution"),
			gov_action_id: GovActionIdSchema.optional(),
			constitution: ConstitutionSchema,
		})
		.strict(),
]);

export const ProposalProcedureNoAnchorSchema = z
	.object({
		deposit: CoinSchema,
		reward_account: RewardAccountSchema,
		gov_action: GovActionSchema,
	})
	.strict();

// CIP-116 Voter: credential voters carry `credential`, SPO voters carry
// `pubkey_hash` under the `spo_keyhash` tag.
const VoterSchema = z.discriminatedUnion("tag", [
	z
		.object({
			tag: z.literal("cc_credential"),
			credential: CredentialSchema,
		})
		.strict(),
	z
		.object({
			tag: z.literal("drep_credential"),
			credential: CredentialSchema,
		})
		.strict(),
	z
		.object({
			tag: z.literal("spo_keyhash"),
			pubkey_hash: z.string(),
		})
		.strict(),
]);

const VoteSchema = z.enum(["yes", "no", "abstain"]);

const VotingProcedureNoAnchorSchema = z
	.object({
		vote: VoteSchema,
	})
	.strict();

export const VotingProceduresNoAnchorSchema = z
	.array(
		z
			.object({
				key: VoterSchema,
				value: z
					.array(
						z
							.object({
								key: GovActionIdSchema,
								value: VotingProcedureNoAnchorSchema,
							})
							.strict(),
					)
					.min(1),
			})
			.strict(),
	)
	.min(1);

export const RegisterDrepNoAnchorSchema = z
	.object({
		tag: z.literal("register_drep"),
		drep_credential: CredentialSchema,
		coin: CoinSchema,
	})
	.strict();

export const UpdateDrepNoAnchorSchema = z
	.object({
		tag: z.literal("update_drep"),
		drep_credential: CredentialSchema,
	})
	.strict();

export const ResignCommitteeColdNoAnchorSchema = z
	.object({
		tag: z.literal("resign_committee_cold"),
		committee_cold_credential: CredentialSchema,
	})
	.strict();

const CertNoAnchorSchema = z.discriminatedUnion("tag", [
	RegisterDrepNoAnchorSchema,
	UpdateDrepNoAnchorSchema,
	ResignCommitteeColdNoAnchorSchema,
]);

export const OnChainSchema = z.union([
	ProposalProcedureNoAnchorSchema,
	VotingProceduresNoAnchorSchema,
	CertNoAnchorSchema,
]);
