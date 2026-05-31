/**
 * Golden tests against real on-chain governance metadata.
 *
 * Fixtures are taken from IntersectMBO/governance-actions mainnet submissions
 * that include the spec-conformant CIP-169 `body.onChain` block. Each fixture
 * has:
 *   - metadata.jsonld          — the off-chain document with witnesses
 *   - metadata.jsonld.action   — TextEnvelope `Governance proposal` whose
 *                                 cborHex is the VotingProposal CBOR
 *                                 (deposit, reward_account, gov_action, anchor).
 *
 * These tests catch interop drift: if our canonicalize / hash / ed25519
 * pipeline diverges from whatever tooling Intersect used to sign these, the
 * witness verification flips from `true` to `false`.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve as nodeResolve } from "node:path";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { cip108, cip169 } from "../index.js";

const FIXTURE_ROOT = nodeResolve(
	import.meta.dir,
	"..",
	"..",
	"docs",
	"examples",
	"fixtures",
	"governance-actions",
);

beforeAll(() => {
	cip169.setCardanoSerializationLib(CSL);
});

interface RealFixture {
	name: string;
	/** Number of `authors[]` entries with a witness. */
	expectedAuthors: number;
	/** witnessAlgorithm per author, in order. */
	expectedWitnessAlgorithms: ("ed25519" | "CIP-8" | "CIP-0008")[];
	expectedGovActionTag: string;
	/**
	 * Real-world metadata documents currently omit fields that are present
	 * on-chain (e.g. `policy_hash` on treasury_withdrawals_action). When set,
	 * verifyAgainstTx is expected to report a mismatch on these paths.
	 */
	expectedOnChainDiffPaths?: string[];
}

const FIXTURES: RealFixture[] = [
	{
		name: "tweag-twa",
		expectedAuthors: 1,
		expectedWitnessAlgorithms: ["ed25519"],
		expectedGovActionTag: "treasury_withdrawals_action",
		// Metadata document omits gov_action.policy_hash that the on-chain
		// proposal carries — known real-world data issue (the metadata is
		// "lying" about the proposal: it could be reused for a different
		// policy_hash without detection from the metadata alone).
		expectedOnChainDiffPaths: ["gov_action.policy_hash"],
	},
	{
		name: "emurgo-sponsorship",
		expectedAuthors: 2,
		expectedWitnessAlgorithms: ["ed25519", "CIP-0008"],
		expectedGovActionTag: "treasury_withdrawals_action",
		expectedOnChainDiffPaths: ["gov_action.policy_hash"],
	},
	{
		name: "emurgo-sponsorship-upgrade",
		expectedAuthors: 1,
		expectedWitnessAlgorithms: ["ed25519"],
		expectedGovActionTag: "treasury_withdrawals_action",
		// This fixture's .action file is missing in the upstream repo, so
		// onChain comparison is skipped (see loadFixture).
	},
	{
		name: "budget-process-info",
		expectedAuthors: 1,
		expectedWitnessAlgorithms: ["ed25519"],
		expectedGovActionTag: "info_action",
		// info_action carries no on-chain payload beyond the tag, so no diff.
	},
];

function loadFixture(name: string): {
	rawBytes: Uint8Array;
	document: Record<string, unknown>;
	actionCborHex: string | null;
} {
	const dir = `${FIXTURE_ROOT}/${name}`;
	const rawBytes = new Uint8Array(readFileSync(`${dir}/metadata.jsonld`));
	const document = JSON.parse(new TextDecoder().decode(rawBytes)) as Record<
		string,
		unknown
	>;
	let actionCborHex: string | null = null;
	try {
		const action = JSON.parse(
			readFileSync(`${dir}/metadata.jsonld.action`, "utf8"),
		) as { cborHex?: string };
		actionCborHex = action.cborHex ?? null;
	} catch {
		// Some submissions don't ship the .action file; skip on-chain compare.
	}
	return { rawBytes, document, actionCborHex };
}

/**
 * Wrap a real VotingProposal CBOR into a minimal Conway transaction body so
 * we can run it through `verifyAgainstTx`. The library's existing public
 * surface decodes full transactions, not bare proposal procedures.
 */
function wrapProposalAsTxHex(votingProposalCborHex: string): string {
	const proposal = CSL.VotingProposal.from_hex(votingProposalCborHex);
	const proposals = CSL.VotingProposals.new();
	proposals.add(proposal);

	const inputs = CSL.TransactionInputs.new();
	inputs.add(
		CSL.TransactionInput.new(CSL.TransactionHash.from_hex("00".repeat(32)), 0),
	);
	const outputs = CSL.TransactionOutputs.new();
	outputs.add(
		CSL.TransactionOutput.new(
			CSL.EnterpriseAddress.new(
				1,
				CSL.Credential.from_keyhash(
					CSL.Ed25519KeyHash.from_hex("00".repeat(28)),
				),
			).to_address(),
			CSL.Value.new(CSL.BigNum.from_str("2000000")),
		),
	);
	const body = CSL.TransactionBody.new_tx_body(
		inputs,
		outputs,
		CSL.BigNum.from_str("200000"),
	);
	body.set_voting_proposals(proposals);

	const tx = CSL.Transaction.new(
		body,
		CSL.TransactionWitnessSet.new(),
		undefined,
	);
	return tx.to_hex();
}

describe("real-world fixtures from IntersectMBO/governance-actions (mainnet, 2026)", () => {
	for (const fixture of FIXTURES) {
		describe(fixture.name, () => {
			const loaded = loadFixture(fixture.name);

			test("parses + validates as CIP-108", () => {
				const r = cip108.parse(loaded.document);
				expect(r.success).toBe(true);
			});

			test(`document has ${fixture.expectedAuthors} author(s)`, () => {
				const authors = (loaded.document.authors as unknown[]) ?? [];
				expect(authors).toHaveLength(fixture.expectedAuthors);
			});

			test(`body.onChain.gov_action.tag is "${fixture.expectedGovActionTag}"`, () => {
				const body = loaded.document.body as Record<string, unknown>;
				const onChain = body.onChain as {
					gov_action: { tag: string };
				};
				expect(onChain.gov_action.tag).toBe(fixture.expectedGovActionTag);
			});

			test("every witness verifies (ed25519 raw or CIP-8 COSE_Sign1)", async () => {
				const r = await cip108.verify(
					{ document: loaded.document, rawBytes: loaded.rawBytes },
					{ contextOptions: { policy: "bundled-only" } },
				);
				expect(r.success).toBe(true);
				if (!r.success) return;
				expect(r.data.witnesses.length).toBe(fixture.expectedAuthors);
				for (let i = 0; i < r.data.witnesses.length; i++) {
					expect(r.data.witnesses[i].witnessAlgorithm).toBe(
						fixture.expectedWitnessAlgorithms[i],
					);
					expect(r.data.witnesses[i].signatureValid).toBe(true);
				}
				expect(r.data.valid).toBe(true);
			});

			const actionCborHex = loaded.actionCborHex;
			if (actionCborHex) {
				const expectedDiffs = fixture.expectedOnChainDiffPaths ?? [];
				if (expectedDiffs.length === 0) {
					test("body.onChain matches the action CBOR (verifyAgainstTx)", async () => {
						const txHex = wrapProposalAsTxHex(actionCborHex);
						const r = await cip169.verifyAgainstTx(loaded.document, txHex);
						expect(r.success).toBe(true);
						if (!r.success) return;
						if (!r.data.matched) {
							console.error(`${fixture.name} mismatch:`, r.data.differences);
						}
						expect(r.data.matched).toBe(true);
					});
				} else {
					test(`verifyAgainstTx surfaces known real-world data diff at ${expectedDiffs.join(", ")}`, async () => {
						const txHex = wrapProposalAsTxHex(actionCborHex);
						const r = await cip169.verifyAgainstTx(loaded.document, txHex);
						expect(r.success).toBe(true);
						if (!r.success) return;
						expect(r.data.matched).toBe(false);
						if (r.data.matched) return;
						const diffPaths = r.data.differences.map((d) => d.path);
						for (const expected of expectedDiffs) {
							expect(diffPaths).toContain(expected);
						}
					});
				}
			}
		});
	}
});
