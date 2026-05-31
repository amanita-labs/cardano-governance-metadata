import { runCipSuite } from "../../__tests__/helpers/cip-suite.js";
import { parse, validate, verify } from "../index.js";

const CIP136_CTX =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-0136.common.jsonld";

const validDocument: Record<string, unknown> = {
	"@context": CIP136_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		summary:
			"Vote NO on action because the proposed change introduces unbounded risk.",
		rationaleStatement:
			"After detailed analysis we believe the action is not aligned with the constitution.",
		precedentDiscussion: "Similar action was rejected in epoch 510.",
		counterargumentDiscussion:
			"Proponents argue the change unlocks ecosystem growth, but the risk is not mitigated.",
		conclusion: "Vote NO until the risk is properly addressed.",
		internalVote: {
			constitutional: 0,
			unconstitutional: 12,
			abstain: 1,
			didNotVote: 0,
			againstVote: 0,
		},
	},
};

// summary exceeds the 300-char limit
const invalidDocument: Record<string, unknown> = {
	"@context": CIP136_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		summary: "X".repeat(301),
		rationaleStatement: "rationale",
	},
};

runCipSuite(
	"cip136",
	{ parse, validate, verify },
	{ validDocument, invalidDocument },
);
