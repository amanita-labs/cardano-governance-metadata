import { z } from "zod";

const CoinSchema = z.string().regex(/^\d+$/);

const CredentialSchema = z
	.object({
		tag: z.enum(["pubkey_hash", "script_hash"]),
		value: z.string(),
	})
	.passthrough();

const RewardAccountSchema = z.string();

const GovActionIdSchema = z
	.object({
		transaction_id: z.string(),
		gov_action_index: z.union([z.string(), z.number()]),
	})
	.passthrough();

const ProtocolVersionSchema = z
	.object({
		major: z.number(),
		minor: z.number(),
	})
	.passthrough();

const UnitIntervalSchema = z
	.object({
		numerator: z.union([z.string(), z.number()]),
		denominator: z.union([z.string(), z.number()]),
	})
	.passthrough();

const RewardSchema = z
	.object({
		key: RewardAccountSchema,
		value: CoinSchema,
	})
	.passthrough();

const CommitteeMemberSchema = z
	.object({
		key: CredentialSchema,
		value: z.union([z.string(), z.number()]),
	})
	.passthrough();

const ConstitutionSchema = z
	.object({
		anchor: z.unknown().optional(),
		script_hash: z.string().optional(),
	})
	.passthrough();

const ProtocolParamUpdateSchema = z.record(z.unknown());

const GovActionSchema = z.discriminatedUnion("tag", [
	z
		.object({
			tag: z.literal("info_action"),
			gov_action_id: GovActionIdSchema.optional(),
		})
		.passthrough(),
	z
		.object({
			tag: z.literal("parameter_change_action"),
			gov_action_id: GovActionIdSchema.optional(),
			protocol_param_update: ProtocolParamUpdateSchema,
			policy_hash: z.string().optional(),
		})
		.passthrough(),
	z
		.object({
			tag: z.literal("hard_fork_initiation_action"),
			gov_action_id: GovActionIdSchema.optional(),
			protocol_version: ProtocolVersionSchema,
		})
		.passthrough(),
	z
		.object({
			tag: z.literal("treasury_withdrawals_action"),
			rewards: z.array(RewardSchema).optional(),
			policy_hash: z.string().optional(),
		})
		.passthrough(),
	z
		.object({
			tag: z.literal("no_confidence"),
			gov_action_id: GovActionIdSchema.optional(),
		})
		.passthrough(),
	z
		.object({
			tag: z.literal("update_committee"),
			gov_action_id: GovActionIdSchema.optional(),
			members_to_remove: z.array(CredentialSchema).optional(),
			committee: z.array(CommitteeMemberSchema),
			signature_threshold: UnitIntervalSchema,
		})
		.passthrough(),
	z
		.object({
			tag: z.literal("new_constitution"),
			gov_action_id: GovActionIdSchema.optional(),
			constitution: ConstitutionSchema,
		})
		.passthrough(),
]);

export const ProposalProcedureNoAnchorSchema = z
	.object({
		deposit: CoinSchema,
		reward_account: RewardAccountSchema,
		gov_action: GovActionSchema,
	})
	.passthrough();

const VoterSchema = z
	.object({
		tag: z.enum([
			"constitutional_committee_hot_credential",
			"drep_credential",
			"staking_pool_key_hash",
		]),
		credential: CredentialSchema.optional(),
		key_hash: z.string().optional(),
		pubkey_hash: z.string().optional(),
	})
	.passthrough();

const VoteSchema = z.enum(["yes", "no", "abstain"]);

const VotingProcedureNoAnchorSchema = z
	.object({
		vote: VoteSchema,
	})
	.passthrough();

export const VotingProceduresNoAnchorSchema = z.array(
	z
		.object({
			key: VoterSchema,
			value: z.array(
				z
					.object({
						key: GovActionIdSchema,
						value: VotingProcedureNoAnchorSchema,
					})
					.passthrough(),
			),
		})
		.passthrough(),
);

export const RegisterDrepNoAnchorSchema = z
	.object({
		tag: z.literal("register_drep"),
		drep_credential: CredentialSchema,
		coin: CoinSchema,
	})
	.passthrough();

export const UpdateDrepNoAnchorSchema = z
	.object({
		tag: z.literal("update_drep"),
		drep_credential: CredentialSchema,
	})
	.passthrough();

export const ResignCommitteeColdNoAnchorSchema = z
	.object({
		tag: z.literal("resign_committee_cold"),
		committee_cold_credential: CredentialSchema,
	})
	.passthrough();

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
