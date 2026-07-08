import { z } from "zod";

// JSON Schema maxLength counts Unicode code points, whereas Zod's
// .max() counts UTF-16 code units — astral characters (emoji, some CJK)
// would count double under .max(). Match the spec's semantics.
export const maxCodePoints = (limit: number) =>
	z.string().refine((value) => [...value].length <= limit, {
		message: `String must contain at most ${limit} character(s)`,
	});

export const HashAlgorithmSchema = z.literal("blake2b-256");

// CIP-100 spec allows "ed25519" or "CIP-8" (the COSE_Sign1 envelope from
// CIP-8 Cardano Message Signing). Real-world docs also use "CIP-0008", so
// accept the zero-padded variant as a synonym.
export const WitnessAlgorithmSchema = z.union([
	z.literal("ed25519"),
	z.literal("CIP-8"),
	z.literal("CIP-0008"),
]);

export const WitnessSchema = z.object({
	witnessAlgorithm: WitnessAlgorithmSchema,
	publicKey: z.string(),
	signature: z.string(),
});

export const AuthorSchema = z.object({
	name: z.string().optional(),
	witness: WitnessSchema.optional(),
});

export const ReferenceSchema = z.object({
	"@type": z.enum(["GovernanceMetadata", "Other"]),
	label: z.string(),
	uri: z.string(),
});

export const ReferenceHashSchema = z.object({
	hashDigest: z.string(),
	hashAlgorithm: HashAlgorithmSchema,
});

export const HashedReferenceSchema = ReferenceSchema.extend({
	referenceHash: ReferenceHashSchema.optional(),
});

export const ExternalUpdateSchema = z.object({
	title: z.string(),
	uri: z.string(),
});
