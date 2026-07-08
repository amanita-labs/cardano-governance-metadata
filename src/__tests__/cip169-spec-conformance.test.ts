/**
 * CIP-0169 spec conformance suite.
 *
 * Runs the library against the CIP-0169 specification's own examples and
 * test vectors, vendored byte-identical in
 * `docs/examples/fixtures/cip-0169-spec/` (see PROVENANCE.md there for the
 * pinned spec commit). Golden hashes, author keys, and negative vectors are
 * hardcoded from the spec's `test-vector.md`:
 *
 * - all 9 valid examples validate, reproduce both golden hashes
 *   (file content hash + canonicalized body hash), and every author
 *   signature verifies;
 * - the `forbidden-anchor` negative vector is rejected by validation;
 * - all 7 Preview-testnet documents verify end-to-end against their
 *   cardano-cli text envelopes, including the anchor-hash check;
 * - negative vectors #2 (metadata replay) and #3 (missing policy_hash)
 *   produce the exact expected difference paths.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve as nodeResolve } from "node:path";
import * as CSL from "@emurgo/cardano-serialization-lib-nodejs";
import { canonicalizeBody } from "../core/canonicalize.js";
import { hashBlake2b256, hashBlake2b256String } from "../core/hash.js";
import { verifyEd25519Signature } from "../core/verify-signature.js";
import { cip100, cip108, cip119, cip136, cip169 } from "../index.js";

const SPEC_ROOT = nodeResolve(
	import.meta.dir,
	"..",
	"..",
	"docs",
	"examples",
	"fixtures",
	"cip-0169-spec",
);

beforeAll(() => {
	cip169.setCardanoSerializationLib(CSL);
});

// test-vector.md § Authors
const AUTHOR_1_PUBKEY =
	"7ea09a34aebb13c9841c71397b1cabfec5ddf950405293dee496cac2f437480a";
const AUTHOR_2_PUBKEY =
	"3ccd241cffc9b3618044b97d036d8614593d8b017c340f1dee8773385517654b";

// test-vector.md § Negative Vectors #3 — the constitution's guardrails
// script hash the ledger attaches on-chain.
const GUARDRAILS_SCRIPT_HASH =
	"fa24fb305126805cf2164c161d852a0e7330cf988f1fe558cf7d4a64";

type ParseModule =
	| typeof cip100
	| typeof cip108
	| typeof cip119
	| typeof cip136;

interface SpecExample {
	name: string;
	/** Golden blake2b-256 of the file's exact bytes (test-vector.md). */
	fileHash: string;
	/** Golden blake2b-256 of the canonicalized body N-Quads (test-vector.md). */
	bodyHash: string;
	/** Downstream CIP the document's body follows. */
	module: ParseModule;
	moduleName: string;
	/** Public keys expected to witness the body hash, in authors[] order. */
	authorPubKeys: string[];
}

// test-vector.md §§ Governance Actions / Votes / Certificates
const SPEC_EXAMPLES: SpecExample[] = [
	{
		name: "parameter-change",
		fileHash:
			"519e82090dfe6a0156bd700fd8cba8aa821fd5ea2103be9b36896efea58a5ffe",
		bodyHash:
			"1b5315408e7b9d28920eb3acc1e0a3c54028ca7e2914ab8947be10c7ebbc5592",
		module: cip108,
		moduleName: "cip108",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "treasury-withdrawal",
		fileHash:
			"b43eeecfcc96e15aff04031bd89cacbaa8a8320d2e686d57442b4a11bfa44468",
		bodyHash:
			"271919c67490332f838362794907860f84a1121d809677d307ec120c23a248fb",
		module: cip108,
		moduleName: "cip108",
		authorPubKeys: [AUTHOR_1_PUBKEY, AUTHOR_2_PUBKEY],
	},
	{
		name: "info-action",
		fileHash:
			"aa81de55faabe0b83c8259dead46c0d620cc1196553db09fe8762b69a7486257",
		bodyHash:
			"3c7d3967df872ecf1a15925f9b8c0481922663560d7b4166a928a59995406ecb",
		module: cip108,
		moduleName: "cip108",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "new-constitution",
		fileHash:
			"ae733cc4879586038c72cc8320b66e749095af0cfdfa9ec864aec4e57d207173",
		bodyHash:
			"aa5ee2ba2efafc92bb34cb4a790b5ca4532947e0f8335e16272a6756750b9e41",
		module: cip108,
		moduleName: "cip108",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "vote",
		fileHash:
			"ad8c5f7c1b73f13c76371047e96f492ad890f6d1d8d585c9d81ffd240a92c9ae",
		bodyHash:
			"94ec7c65ed1342bb9b92e1b524aad04f9c2128eedbae2f3bbf5d7776f49ce72e",
		module: cip100,
		moduleName: "cip100",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "committee-vote",
		fileHash:
			"2eea6d9906e8a5660a3fecc64cafac0815e7b8b170b09a5ad13ba3417a067b67",
		bodyHash:
			"8482fc078d8b031eb31b6c898672a0c828ee176b43bd72c24aaa6a8ad1c6cdec",
		module: cip136,
		moduleName: "cip136",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "drep-registration",
		fileHash:
			"f421a41ec0081c16a9b23e75e71f808de4c3e933254a529dfb26d205e031c783",
		bodyHash:
			"ffa5db2a497b8b51cc1302def50366aacb3a30aee77a8806d9c762fd0d50ef43",
		module: cip119,
		moduleName: "cip119",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "drep-update",
		fileHash:
			"c7f4b4f42531c6ee02aab761dee349650b07f48ef58a0f3122c7d12377bcf8c9",
		bodyHash:
			"1211853ce1cda2fbe07c0512c37310942492687585a8ba1e6eee49fbcc8c18d5",
		module: cip119,
		moduleName: "cip119",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
	{
		name: "committee-resignation",
		fileHash:
			"3e16fb0d2f6885cb9ad0f2be6417d2162bcd6f57ea0cf1d4da6932ed2dd1ecd6",
		bodyHash:
			"b9521ad29fc7bb79f6f790053a7f97a412047323c01c183f0790327ebfbbf309",
		module: cip100,
		moduleName: "cip100",
		authorPubKeys: [AUTHOR_1_PUBKEY],
	},
];

interface PreviewExample {
	name: string;
	envelopeFile: string;
	/** Golden on-chain anchor hash = blake2b-256 of the verbatim document. */
	anchorHash: string;
}

// test-vector.md § Live Examples (Preview testnet) / Anchors
const PREVIEW_EXAMPLES: PreviewExample[] = [
	{
		name: "info-action",
		envelopeFile: "info-action.action",
		anchorHash:
			"13a7e4b127b18ad62f39ca6d72cb73d7bcd0eab00a0a5a1dc65a25fab84f223f",
	},
	{
		name: "treasury-withdrawal",
		envelopeFile: "treasury-withdrawal.action",
		anchorHash:
			"b85c007f9838ffe73e3fa6878db3e2ec2b2e9d901037782b1e384453174fc85a",
	},
	{
		name: "parameter-change",
		envelopeFile: "parameter-change.action",
		anchorHash:
			"831056012804ea41a1ecd1e3ca0dbd9c58a46550942f2dc5dce93e033e31d4e2",
	},
	{
		name: "new-constitution",
		envelopeFile: "new-constitution.action",
		anchorHash:
			"25c51a11d0e946c1959e851e3a6413bb89734be624da4673fd83a08524ec6648",
	},
	{
		name: "vote",
		envelopeFile: "vote.vote",
		anchorHash:
			"7f95c810df8e66cc9bccc2dd08303342b99a3600326c75939da4009dc498d1e2",
	},
	{
		name: "drep-registration",
		envelopeFile: "drep-registration.cert",
		anchorHash:
			"c92199160c7915a92c3e3e7469a61912a8f5c706d31162b2a5f5a1f73db6a405",
	},
	{
		name: "drep-update",
		envelopeFile: "drep-update.cert",
		anchorHash:
			"1bd1c918a0f7684320299c1b3999006ec8ba56f785dbebd3b0455681501e8b7d",
	},
];

interface LoadedDoc {
	rawBytes: Uint8Array;
	document: Record<string, unknown>;
}

function loadDoc(relPath: string): LoadedDoc {
	const rawBytes = new Uint8Array(readFileSync(`${SPEC_ROOT}/${relPath}`));
	const document = JSON.parse(new TextDecoder().decode(rawBytes)) as Record<
		string,
		unknown
	>;
	return { rawBytes, document };
}

function onChainOf(document: Record<string, unknown>): unknown {
	return (document.body as Record<string, unknown>).onChain;
}

async function computeBodyHash(
	document: Record<string, unknown>,
): Promise<string> {
	const r = await canonicalizeBody(
		{ "@context": document["@context"], body: document.body },
		{ contextOptions: { policy: "bundled-only" } },
	);
	expect(r.success).toBe(true);
	if (!r.success) throw new Error("canonicalization failed");
	return hashBlake2b256String(r.data);
}

describe("CIP-0169 spec conformance — valid examples", () => {
	for (const example of SPEC_EXAMPLES) {
		describe(example.name, () => {
			const { rawBytes, document } = loadDoc(`examples/${example.name}.jsonld`);

			test("body.onChain validates against OnChainSchema", () => {
				const r = cip169.validate(onChainOf(document));
				expect(r.success).toBe(true);
			});

			test(`full document parses as ${example.moduleName}`, () => {
				const r = example.module.parse(document);
				expect(r.success).toBe(true);
			});

			test("file content hash matches golden vector", () => {
				expect(hashBlake2b256(rawBytes)).toBe(example.fileHash);
			});

			test("canonicalized body hash matches golden vector", async () => {
				expect(await computeBodyHash(document)).toBe(example.bodyHash);
			});

			test("every author signature verifies over the body hash", async () => {
				const authors = document.authors as Array<{
					witness: {
						witnessAlgorithm: string;
						publicKey: string;
						signature: string;
					};
				}>;
				expect(authors).toHaveLength(example.authorPubKeys.length);
				for (let i = 0; i < authors.length; i++) {
					const witness = authors[i].witness;
					expect(witness.witnessAlgorithm).toBe("ed25519");
					expect(witness.publicKey).toBe(example.authorPubKeys[i]);
					expect(
						await verifyEd25519Signature(
							witness.signature,
							example.bodyHash,
							witness.publicKey,
						),
					).toBe(true);
				}
			});
		});
	}
});

describe("CIP-0169 spec conformance — negative vector #1 (forbidden self-referential anchor)", () => {
	const { document } = loadDoc("examples/invalid/forbidden-anchor.jsonld");

	test("body.onChain fails validation, naming the unexpected anchor key", () => {
		const r = cip169.validate(onChainOf(document));
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(JSON.stringify(r.error.issues)).toContain("anchor");
	});

	test("full document fails cip108.parse", () => {
		const r = cip108.parse(document);
		expect(r.success).toBe(false);
	});
});

describe("CIP-0169 spec conformance — Preview testnet end-to-end", () => {
	for (const example of PREVIEW_EXAMPLES) {
		describe(example.name, () => {
			const { rawBytes, document } = loadDoc(
				`examples/preview/${example.name}.jsonld`,
			);
			const envelopeJson = readFileSync(
				`${SPEC_ROOT}/examples/preview/${example.envelopeFile}`,
				"utf8",
			);

			test("document file hash matches the on-chain anchor hash", () => {
				expect(hashBlake2b256(rawBytes)).toBe(example.anchorHash);
			});

			test("body.onChain matches the envelope (verifyAgainstEnvelope)", () => {
				const r = cip169.verifyAgainstEnvelope(document, envelopeJson);
				expect(r.success).toBe(true);
				if (!r.success) return;
				if (!r.data.matched) {
					console.error(`${example.name} mismatch:`, r.data.differences);
				}
				expect(r.data.matched).toBe(true);
			});

			test("decoded envelope anchor data_hash equals the golden anchor hash", () => {
				const r = cip169.decodeGovEnvelope(envelopeJson);
				expect(r.success).toBe(true);
				if (!r.success) return;
				expect(r.data.anchors).toHaveLength(1);
				expect(r.data.anchors[0].data_hash).toBe(example.anchorHash);
			});
		});
	}

	test("verifyAgainstTx matches when a proposal envelope is wrapped in a full transaction", async () => {
		const { document } = loadDoc("examples/preview/info-action.jsonld");
		const envelope = JSON.parse(
			readFileSync(`${SPEC_ROOT}/examples/preview/info-action.action`, "utf8"),
		) as { cborHex: string };
		const r = await cip169.verifyAgainstTx(
			document,
			wrapProposalAsTxHex(envelope.cborHex),
		);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.matched).toBe(true);
	});
});

describe("CIP-0169 spec conformance — negative vector #2 (metadata replay / on-chain mismatch)", () => {
	test("treasury-withdrawal metadata does not match an action paying a different address", () => {
		const { document } = loadDoc("examples/treasury-withdrawal.jsonld");
		const onChain = structuredClone(onChainOf(document)) as {
			gov_action: { rewards: Array<{ key: string; value: string }> };
		};
		// The replayed on-chain action pays a different stake address.
		const replayedAction = structuredClone(onChain);
		replayedAction.gov_action.rewards[0].key =
			"stake1u9u5vlrf4xkxv2qpwngf6cjhtw542ayty80v8dyr49rf5egnuvsnm";

		const r = cip169.compareOnChain(onChain, replayedAction);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.equal).toBe(false);
		expect(r.data.differences.map((d) => d.path)).toContain(
			"gov_action.rewards[0].key",
		);
	});
});

describe("CIP-0169 spec conformance — negative vector #3 (omitted policy_hash)", () => {
	test("metadata missing gov_action.policy_hash mismatches the on-chain action", () => {
		const { document } = loadDoc("examples/preview/treasury-withdrawal.jsonld");
		const envelopeJson = readFileSync(
			`${SPEC_ROOT}/examples/preview/treasury-withdrawal.action`,
			"utf8",
		);
		// Recreate the superseded submission: same document, policy_hash omitted.
		const superseded = structuredClone(document) as {
			body: { onChain: { gov_action: { policy_hash?: string } } };
		};
		const { policy_hash: _omitted, ...withoutPolicyHash } =
			superseded.body.onChain.gov_action;
		superseded.body.onChain.gov_action = withoutPolicyHash;

		const r = cip169.verifyAgainstEnvelope(superseded, envelopeJson);
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(r.data.matched).toBe(false);
		if (r.data.matched) return;
		expect(r.data.differences).toHaveLength(1);
		expect(r.data.differences[0].path).toBe("gov_action.policy_hash");
		expect(r.data.differences[0].actionValue).toBe(GUARDRAILS_SCRIPT_HASH);
	});
});

describe("CIP-0169 strict validation regressions", () => {
	const validProposal = {
		deposit: "100000000000",
		reward_account:
			"stake1uxsm9s75uhm20wxf6rsl9ga5chtw079fkrqa9cl55kmv0kqfk32j7",
		gov_action: { tag: "info_action" },
	};

	test("unknown keys are rejected (unevaluatedProperties: false)", () => {
		const r = cip169.validate({
			...validProposal,
			anchor: { url: "ipfs://x", data_hash: "00".repeat(32) },
		});
		expect(r.success).toBe(false);
	});

	test("update_drep must not carry coin", () => {
		const r = cip169.validate({
			tag: "update_drep",
			drep_credential: { tag: "pubkey_hash", value: "ab".repeat(28) },
			coin: "500000000",
		});
		expect(r.success).toBe(false);
	});

	test("info_action must not carry gov_action_id", () => {
		const r = cip169.validate({
			...validProposal,
			gov_action: {
				tag: "info_action",
				gov_action_id: { transaction_id: "00".repeat(32), gov_action_index: 0 },
			},
		});
		expect(r.success).toBe(false);
	});

	test("empty VotingProcedures is rejected (minItems: 1)", () => {
		expect(cip169.validate([]).success).toBe(false);
	});

	test("cc_credential voter is accepted; the old CSL-flavored tag is not", () => {
		const entry = (tag: string) => [
			{
				key: {
					tag,
					credential: { tag: "pubkey_hash", value: "ab".repeat(28) },
				},
				value: [
					{
						key: {
							transaction_id: "00".repeat(32),
							gov_action_index: 0,
						},
						value: { vote: "yes" },
					},
				],
			},
		];
		expect(cip169.validate(entry("cc_credential")).success).toBe(true);
		expect(
			cip169.validate(entry("constitutional_committee_hot_credential")).success,
		).toBe(false);
	});

	test("Constitution requires its anchor (retained per CIP-116)", () => {
		const r = cip169.validate({
			...validProposal,
			gov_action: { tag: "new_constitution", constitution: {} },
		});
		expect(r.success).toBe(false);
	});
});

/**
 * Wrap a bare VotingProposal CBOR into a minimal Conway transaction so the
 * full-transaction path (`verifyAgainstTx`) is exercised too. Mirrors the
 * helper in real-fixtures.test.ts.
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
