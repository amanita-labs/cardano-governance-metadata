import { runCipSuite } from "../../__tests__/helpers/cip-suite.js";
import { parse, validate, verify } from "../index.js";

const CIP100_CTX =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld";

const validDocument: Record<string, unknown> = {
	"@context": CIP100_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		comment: "Hello, governance world",
		references: [
			{
				"@type": "Other",
				label: "Spec",
				uri: "https://example.com/spec",
			},
		],
	},
};

// Missing required `body` field
const invalidDocument: Record<string, unknown> = {
	"@context": CIP100_CTX,
	hashAlgorithm: "blake2b-256",
};

runCipSuite(
	"cip100",
	{ parse, validate, verify },
	{ validDocument, invalidDocument },
);
