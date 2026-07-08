import { beforeAll, describe, expect, test } from "bun:test";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { decodeConwayTx, setCardanoSerializationLib } from "../index.js";
import {
	buildDivergentParamChangeActionTx,
	buildDrepUpdateTx,
	buildHardForkActionTx,
	buildInfoActionTx,
	buildNewConstitutionActionTx,
	buildNoConfidenceActionTx,
	buildParameterChangeActionTx,
	buildResignCommitteeColdTx,
	buildUpdateCommitteeActionTx,
	buildVotingProcedureFromCcHotTx,
	buildVotingProcedureFromPoolTx,
	buildVotingProcedureTx,
} from "./fixtures/build-tx.js";
import { REAL_PARAM_CHANGE_TX_HEX } from "./fixtures/real-param-change-tx.js";

beforeAll(() => {
	setCardanoSerializationLib(CSL);
});

const DREP_HEX = "44".repeat(28);
const SCRIPT_HEX = "55".repeat(28);
const GOV_TX_HEX = "ab".repeat(32);

describe("cip169.decodeConwayTx — GovAction variants", () => {
	test("info_action decodes to { tag: 'info_action' }", () => {
		const r = decodeConwayTx(buildInfoActionTx().txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("info_action");
	});

	test("hard_fork_initiation_action decodes with protocol_version", () => {
		const r = decodeConwayTx(buildHardForkActionTx(10, 1).txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("hard_fork_initiation_action");
		if (action.tag !== "hard_fork_initiation_action") return;
		expect(action.protocol_version).toEqual({ major: 10, minor: 1 });
	});

	test("no_confidence decodes", () => {
		const r = decodeConwayTx(buildNoConfidenceActionTx().txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.proposalProcedures[0]?.gov_action.tag).toBe("no_confidence");
	});

	test("parameter_change_action decodes with protocol_param_update", () => {
		const r = decodeConwayTx(buildParameterChangeActionTx().txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("parameter_change_action");
		if (action.tag !== "parameter_change_action") return;
		expect(action.protocol_param_update).toBeDefined();
		// CSL emits these as nested fields; just verify the keys we set are present.
		const upd = action.protocol_param_update as Record<string, unknown>;
		expect(upd.minfee_a).toBeDefined();
		expect(upd.minfee_b).toBeDefined();
	});

	test("parameter_change_action emits a sparse, CIP-116-named protocol_param_update", () => {
		const r = decodeConwayTx(REAL_PARAM_CHANGE_TX_HEX);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("parameter_change_action");
		if (action.tag !== "parameter_change_action") return;
		const upd = action.protocol_param_update as Record<string, unknown>;
		// Only the changed field is present — no `null` placeholders for the
		// ~32 untouched parameters.
		expect(Object.keys(upd)).toEqual(["committee_min_size"]);
		// CIP-116 field name, not CSL's `min_committee_size`.
		expect(upd.committee_min_size).toBe(5);
		expect(upd.min_committee_size).toBeUndefined();
	});

	test("protocol_param_update maps every divergent CSL field to its CIP-116 name", () => {
		const r = decodeConwayTx(buildDivergentParamChangeActionTx().txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("parameter_change_action");
		if (action.tag !== "parameter_change_action") return;
		const upd = action.protocol_param_update as Record<string, unknown>;

		// CIP-116 names present...
		expect(upd.committee_min_size).toBe(5);
		expect(upd.committee_max_term_length).toBe(146);
		expect(upd.gov_action_lifetime).toBe(30);
		expect(upd.gov_action_deposit).toBe("100000000000");
		expect(upd.drep_activity).toBe(20);
		expect(upd.min_fee_ref_script_cost_per_byte).toEqual({
			numerator: "15",
			denominator: "1",
		});

		// ...and the CSL-vocabulary names are gone.
		for (const cslName of [
			"min_committee_size",
			"committee_term_limit",
			"governance_action_validity_period",
			"governance_action_deposit",
			"drep_inactivity_period",
			"ref_script_coins_per_byte",
		]) {
			expect(upd[cslName]).toBeUndefined();
		}
	});

	test("update_committee (a.k.a. new_committee) decodes with members + threshold", () => {
		const r = decodeConwayTx(buildUpdateCommitteeActionTx().txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("update_committee");
		if (action.tag !== "update_committee") return;
		expect(action.signature_threshold).toEqual({
			numerator: "2",
			denominator: "3",
		});
		expect(action.committee.length).toBeGreaterThan(0);
		expect(action.committee[0].value).toBe("100");
		expect(action.members_to_remove?.length).toBe(1);
		expect(action.members_to_remove?.[0]).toEqual({
			tag: "script_hash",
			value: "aa".repeat(28),
		});
	});

	test("new_constitution decodes with constitution.anchor", () => {
		const r = decodeConwayTx(
			buildNewConstitutionActionTx(
				"https://test.example/constitution.txt",
				"ab".repeat(32),
			).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const action = r.data.proposalProcedures[0]?.gov_action;
		expect(action.tag).toBe("new_constitution");
		if (action.tag !== "new_constitution") return;
		expect(action.constitution.anchor).toEqual({
			url: "https://test.example/constitution.txt",
			data_hash: "ab".repeat(32),
		});
	});
});

describe("cip169.decodeConwayTx — certificates", () => {
	test("update_drep cert decodes", () => {
		const r = decodeConwayTx(buildDrepUpdateTx(DREP_HEX).txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.certificates).toHaveLength(1);
		const cert = r.data.certificates[0];
		if (!cert) throw new Error("expected one certificate");
		expect(cert.tag).toBe("update_drep");
		if (cert.tag !== "update_drep") return;
		expect(cert.drep_credential).toEqual({
			tag: "pubkey_hash",
			value: DREP_HEX,
		});
	});

	test("resign_committee_cold cert with script_hash credential decodes", () => {
		const r = decodeConwayTx(buildResignCommitteeColdTx(SCRIPT_HEX).txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		const cert = r.data.certificates[0];
		if (!cert) throw new Error("expected one certificate");
		expect(cert.tag).toBe("resign_committee_cold");
		if (cert.tag !== "resign_committee_cold") return;
		expect(cert.committee_cold_credential).toEqual({
			tag: "script_hash",
			value: SCRIPT_HEX,
		});
	});
});

describe("cip169.decodeConwayTx — voting procedures", () => {
	test("yes vote decodes", () => {
		const r = decodeConwayTx(
			buildVotingProcedureTx({
				drepKeyHashHex: DREP_HEX,
				vote: "yes",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 0,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures).not.toBeNull();
		expect(r.data.votingProcedures?.[0].value[0].value.vote).toBe("yes");
	});

	test("no vote decodes", () => {
		const r = decodeConwayTx(
			buildVotingProcedureTx({
				drepKeyHashHex: DREP_HEX,
				vote: "no",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 1,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures?.[0].value[0].value.vote).toBe("no");
	});

	test("abstain vote decodes", () => {
		const r = decodeConwayTx(
			buildVotingProcedureTx({
				drepKeyHashHex: DREP_HEX,
				vote: "abstain",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 2,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures?.[0].value[0].value.vote).toBe("abstain");
	});

	test("voter is exposed as drep_credential with pubkey_hash", () => {
		const r = decodeConwayTx(
			buildVotingProcedureTx({
				drepKeyHashHex: DREP_HEX,
				vote: "yes",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 0,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures?.[0].key).toEqual({
			tag: "drep_credential",
			credential: { tag: "pubkey_hash", value: DREP_HEX },
		});
	});

	test("staking pool voter decodes", () => {
		const POOL = "66".repeat(28);
		const r = decodeConwayTx(
			buildVotingProcedureFromPoolTx({
				poolKeyHashHex: POOL,
				vote: "yes",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 0,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures?.[0].key).toEqual({
			tag: "spo_keyhash",
			pubkey_hash: POOL,
		});
	});

	test("constitutional committee hot voter decodes", () => {
		const CC_HOT = "77".repeat(28);
		const r = decodeConwayTx(
			buildVotingProcedureFromCcHotTx({
				ccHotKeyHashHex: CC_HOT,
				vote: "no",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 0,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures?.[0].key).toEqual({
			tag: "cc_credential",
			credential: { tag: "pubkey_hash", value: CC_HOT },
		});
	});

	test("gov_action_id captures transaction_id and index", () => {
		const r = decodeConwayTx(
			buildVotingProcedureTx({
				drepKeyHashHex: DREP_HEX,
				vote: "yes",
				govActionTxIdHex: GOV_TX_HEX,
				govActionIndex: 7,
			}).txHex,
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.votingProcedures?.[0].value[0].key).toEqual({
			transaction_id: GOV_TX_HEX,
			gov_action_index: 7,
		});
	});
});
