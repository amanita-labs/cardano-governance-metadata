import { z } from "zod";
import { OnChainSchema } from "../cip169/schemas.js";
import {
	AuthorSchema,
	ExternalUpdateSchema,
	ReferenceSchema,
} from "../core/schemas.js";

export const Cip100BodySchema = z
	.object({
		references: z.array(ReferenceSchema).optional(),
		comment: z.string().optional(),
		externalUpdates: z.array(ExternalUpdateSchema).optional(),
		onChain: OnChainSchema.optional(),
	})
	.passthrough();

export const Cip100DocumentSchema = z
	.object({
		"@context": z.unknown(),
		"@type": z.string().optional(),
		"@language": z.string().optional(),
		hashAlgorithm: z.literal("blake2b-256"),
		authors: z.array(AuthorSchema).optional(),
		body: Cip100BodySchema,
	})
	.passthrough();
