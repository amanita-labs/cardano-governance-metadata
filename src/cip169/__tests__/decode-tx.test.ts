import { beforeAll, describe, expect, test } from "bun:test";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { ErrorCode } from "../../index.js";
import { decodeConwayTx, setCardanoSerializationLib } from "../index.js";
import {
	buildDrepRegistrationTx,
	buildTreasuryWithdrawalTx,
} from "./fixtures/build-tx.js";

beforeAll(() => {
	setCardanoSerializationLib(CSL);
});

const RECIPIENT = "22".repeat(28);
const DREP = "33".repeat(28);

describe("cip169.decodeConwayTx", () => {
	test("decodes a treasury withdrawal proposal procedure", () => {
		const { txHex } = buildTreasuryWithdrawalTx({
			recipientStakeKeyHashHex: RECIPIENT,
			amountLovelace: "1234567890",
			deposit: "100000000000",
		});
		const r = decodeConwayTx(txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.proposalProcedures).toHaveLength(1);
		const proposal = r.data.proposalProcedures[0];
		if (!proposal) throw new Error("expected one proposal");
		expect(proposal.deposit).toBe("100000000000");
		expect(proposal.gov_action.tag).toBe("treasury_withdrawals_action");
		if (proposal.gov_action.tag !== "treasury_withdrawals_action") return;
		expect(proposal.gov_action.rewards?.[0]?.value).toBe("1234567890");
		expect(proposal.gov_action.rewards?.[0]?.key).toMatch(/^stake/);
		expect(r.data.certificates).toHaveLength(0);
		expect(r.data.votingProcedures).toBeNull();
	});

	test("decodes a register_drep certificate", () => {
		const { txHex } = buildDrepRegistrationTx({
			drepKeyHashHex: DREP,
			coin: "500000000",
		});
		const r = decodeConwayTx(txHex);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.certificates).toHaveLength(1);
		const cert = r.data.certificates[0];
		if (!cert) throw new Error("expected one cert");
		expect(cert.tag).toBe("register_drep");
		if (cert.tag !== "register_drep") return;
		expect(cert.drep_credential.tag).toBe("pubkey_hash");
		expect(cert.drep_credential.value).toBe(DREP);
		expect(cert.coin).toBe("500000000");
	});

	test("returns CSL_NOT_INITIALIZED when CSL is not registered", () => {
		setCardanoSerializationLib(null as unknown as typeof CSL);
		const r = decodeConwayTx("84a300810000020003");
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.CSL_NOT_INITIALIZED);
		setCardanoSerializationLib(CSL);
	});

	test("returns TX_DECODE_FAILED for malformed CBOR", () => {
		const r = decodeConwayTx("deadbeef");
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.TX_DECODE_FAILED);
	});
});
