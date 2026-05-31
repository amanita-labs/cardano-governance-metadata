import { describe, expect, test } from "bun:test";
import { OnChainSchema, parse, validate } from "../index.js";

describe("cip169.parse / validate", () => {
	test("accepts a treasury_withdrawals_action proposal procedure", () => {
		const onChain = {
			deposit: "100000000000",
			reward_account:
				"stake1uxsm9s75uhm20wxf6rsl9ga5chtw079fkrqa9cl55kmv0kqfk32j7",
			gov_action: {
				tag: "treasury_withdrawals_action",
				rewards: [
					{
						key: "stake1uxsm9s75uhm20wxf6rsl9ga5chtw079fkrqa9cl55kmv0kqfk32j7",
						value: "100000000000",
					},
				],
			},
		};
		const r = parse(onChain);
		expect(r.success).toBe(true);
	});

	test("accepts a register_drep cert", () => {
		const r = parse({
			tag: "register_drep",
			drep_credential: { tag: "pubkey_hash", value: "ab".repeat(28) },
			coin: "500000000",
		});
		expect(r.success).toBe(true);
	});

	test("accepts a votingProcedures array", () => {
		const r = parse([
			{
				key: {
					tag: "drep_credential",
					credential: { tag: "pubkey_hash", value: "cd".repeat(28) },
				},
				value: [
					{
						key: { transaction_id: "ab".repeat(32), gov_action_index: "0" },
						value: { vote: "yes" },
					},
				],
			},
		]);
		expect(r.success).toBe(true);
	});

	test("rejects an unknown gov_action.tag", () => {
		const r = validate({
			deposit: "1",
			reward_account: "stake1...",
			gov_action: { tag: "made_up_action" },
		});
		expect(r.success).toBe(false);
	});

	test("rejects a register_drep with missing coin", () => {
		const r = validate({
			tag: "register_drep",
			drep_credential: { tag: "pubkey_hash", value: "ab".repeat(28) },
		});
		expect(r.success).toBe(false);
	});

	test("OnChainSchema is exposed for direct use", () => {
		const r = OnChainSchema.safeParse({ tag: "info_action_typo" });
		expect(r.success).toBe(false);
	});

	test("parse from JSON string", () => {
		const r = parse(
			JSON.stringify({
				tag: "resign_committee_cold",
				committee_cold_credential: {
					tag: "script_hash",
					value: "ee".repeat(28),
				},
			}),
		);
		expect(r.success).toBe(true);
	});
});
