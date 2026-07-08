import { describe, expect, test } from "bun:test";
import { build as buildCip108 } from "../../cip108/build.js";
import { ValidationError } from "../../core/errors.js";
import * as actions from "../actions.js";
import { build } from "../build.js";
import { parse } from "../parse.js";

const credential = {
	tag: "pubkey_hash" as const,
	value: "00".repeat(28),
};

const govActionId = {
	transaction_id: "ab".repeat(32),
	gov_action_index: 0,
};

describe("cip169.build (OnChain payload)", () => {
	test("validates a proposal procedure payload and pretty-prints it", () => {
		const proposal = {
			deposit: "100000000000",
			reward_account: "stake1...",
			gov_action: actions.infoAction(),
		};
		const result = build(proposal);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error("unreachable");
		expect(result.data.payload).toEqual(proposal);
		expect(result.data.json).toContain("\n");
		expect(JSON.parse(result.data.json)).toEqual(proposal);
	});

	test("round-trips through cip169.parse()", () => {
		const proposal = {
			deposit: "100000000000",
			reward_account: "stake1...",
			gov_action: actions.parameterChange({
				protocol_param_update: { minFeeA: 44 },
			}),
		};
		const built = build(proposal);
		if (!built.success) throw new Error("build failed");
		const parsed = parse(built.data.json);
		expect(parsed.success).toBe(true);
		if (!parsed.success) throw new Error("unreachable");
		expect(parsed.data).toEqual(built.data.payload);
	});

	test("returns ValidationError for an invalid OnChain payload", () => {
		const result = build({ deposit: "not-a-coin-string" } as unknown as never);
		expect(result.success).toBe(false);
		if (result.success) throw new Error("unreachable");
		expect(result.error).toBeInstanceOf(ValidationError);
	});

	test("composes with cip108.build: built OnChain nests cleanly into a CIP-108 body", () => {
		const proposal = {
			deposit: "100000000000",
			reward_account: "stake1...",
			gov_action: actions.treasuryWithdrawals({
				rewards: [{ key: "stake1...", value: "1000000" }],
			}),
		};
		const onChain = build(proposal);
		if (!onChain.success) throw new Error("onchain build failed");

		const docResult = buildCip108({
			body: {
				title: "Treasury withdrawal request",
				abstract: "Withdraw 1 ADA from the treasury for testing.",
				motivation:
					"Demonstrate composability between cip108 and cip169 builders.",
				rationale: "End-to-end test of the build pipeline.",
				onChain: onChain.data.payload,
			},
		});
		expect(docResult.success).toBe(true);
		if (!docResult.success) throw new Error("doc build failed");
		expect(docResult.data.doc.body.onChain).toEqual(proposal);
	});
});

describe("cip169.actions helpers", () => {
	test("infoAction produces the tagged shape", () => {
		expect(actions.infoAction()).toEqual({ tag: "info_action" });
	});

	test("parameterChange embeds protocol_param_update", () => {
		const action = actions.parameterChange({
			protocol_param_update: { minFeeA: 44, minFeeB: 155381 },
			policy_hash: "ab".repeat(28),
		});
		expect(action.tag).toBe("parameter_change_action");
		expect(action.protocol_param_update).toEqual({
			minFeeA: 44,
			minFeeB: 155381,
		});
		expect(action.policy_hash).toBe("ab".repeat(28));
	});

	test("hardForkInitiation requires protocol_version", () => {
		const action = actions.hardForkInitiation({
			protocol_version: { major: 11, minor: 0 },
		});
		expect(action.tag).toBe("hard_fork_initiation_action");
		expect(action.protocol_version).toEqual({ major: 11, minor: 0 });
	});

	test("treasuryWithdrawals tag set; rewards optional", () => {
		expect(actions.treasuryWithdrawals()).toEqual({
			tag: "treasury_withdrawals_action",
		});
		const withRewards = actions.treasuryWithdrawals({
			rewards: [{ key: "stake1...", value: "1000000" }],
		});
		expect(withRewards.rewards).toEqual([
			{ key: "stake1...", value: "1000000" },
		]);
	});

	test("noConfidence is correctly tagged", () => {
		expect(actions.noConfidence()).toEqual({ tag: "no_confidence" });
	});

	test("updateCommittee carries committee and threshold", () => {
		const action = actions.updateCommittee({
			committee: [{ key: credential, value: 100 }],
			signature_threshold: { numerator: 2, denominator: 3 },
		});
		expect(action.tag).toBe("update_committee");
		expect(action.committee).toHaveLength(1);
		expect(action.signature_threshold).toEqual({
			numerator: 2,
			denominator: 3,
		});
	});

	test("newConstitution wraps constitution payload", () => {
		const action = actions.newConstitution({
			constitution: {
				anchor: {
					url: "ipfs://...",
					data_hash: "ab".repeat(32),
				},
			},
		});
		expect(action.tag).toBe("new_constitution");
		expect(action.constitution.anchor).toBeDefined();
	});

	test("registerDrep returns a tagged certificate", () => {
		const cert = actions.registerDrep({
			drep_credential: credential,
			coin: "500000000",
		});
		expect(cert.tag).toBe("register_drep");
		expect(cert.coin).toBe("500000000");
	});

	test("updateDrep is correctly tagged", () => {
		const cert = actions.updateDrep({ drep_credential: credential });
		expect(cert.tag).toBe("update_drep");
	});

	test("resignCommitteeCold is correctly tagged", () => {
		const cert = actions.resignCommitteeCold({
			committee_cold_credential: credential,
		});
		expect(cert.tag).toBe("resign_committee_cold");
	});

	test("votingProcedures is identity over a typed structure", () => {
		const voter = {
			tag: "drep_credential" as const,
			credential,
		};
		const procedures = actions.votingProcedures([
			{
				key: voter,
				value: [{ key: govActionId, value: { vote: "yes" as const } }],
			},
		]);
		expect(procedures).toHaveLength(1);
		expect(procedures[0]?.key.tag).toBe("drep_credential");
	});

	test("each action helper produces a value that cip169.build accepts", () => {
		const samples = [
			{
				deposit: "100",
				reward_account: "stake1...",
				gov_action: actions.infoAction(),
			},
			{
				deposit: "100",
				reward_account: "stake1...",
				gov_action: actions.noConfidence(),
			},
			{
				deposit: "100",
				reward_account: "stake1...",
				gov_action: actions.treasuryWithdrawals(),
			},
		];
		for (const payload of samples) {
			const result = build(payload);
			expect(result.success).toBe(true);
		}
	});
});
