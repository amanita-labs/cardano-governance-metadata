import { runCipSuite } from "../../__tests__/helpers/cip-suite.js";
import { parse, validate, verify } from "../index.js";

const CIP108_CTX =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0108/cip-0108.common.jsonld";

const validDocument: Record<string, unknown> = {
	"@context": CIP108_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		title: "Fund Development Team",
		abstract: "Withdraw 100k ADA to fund development team for Q3.",
		motivation:
			"The team has delivered milestones and requires funding for continued work.",
		rationale:
			"Funding will enable completion of the remaining project deliverables in the next quarter.",
	},
};

// title exceeds the 80-char limit
const invalidDocument: Record<string, unknown> = {
	"@context": CIP108_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		title: "X".repeat(81),
		abstract: "abstract",
		motivation: "motivation",
		rationale: "rationale",
	},
};

runCipSuite(
	"cip108",
	{ parse, validate, verify },
	{ validDocument, invalidDocument },
);
