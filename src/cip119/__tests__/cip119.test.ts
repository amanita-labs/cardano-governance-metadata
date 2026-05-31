import { runCipSuite } from "../../__tests__/helpers/cip-suite.js";
import { parse, validate, verify } from "../index.js";

const CIP119_CTX =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0119/cip-0119.common.jsonld";

const validDocument: Record<string, unknown> = {
	"@context": CIP119_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		givenName: "Alice DRep",
		objectives:
			"Represent stakeholders interested in long-term protocol stability.",
		motivations: "Active participant in governance discussions since 2024.",
		qualifications: "Cardano contributor; participated in CIP review.",
		paymentAddress:
			"addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj0vs2qd4a6v9s8d4zsvflvhf",
	},
};

// givenName exceeds the 80-char limit
const invalidDocument: Record<string, unknown> = {
	"@context": CIP119_CTX,
	hashAlgorithm: "blake2b-256",
	body: {
		givenName: "X".repeat(81),
	},
};

runCipSuite(
	"cip119",
	{ parse, validate, verify },
	{ validDocument, invalidDocument },
);
