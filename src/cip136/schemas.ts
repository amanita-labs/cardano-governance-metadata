import { z } from "zod";
import {
  AuthorSchema,
  ExternalUpdateSchema,
  HashedReferenceSchema,
} from "../core/schemas.js";
import { OnChainSchema } from "../cip169/schemas.js";

const Cip136ReferenceSchema = HashedReferenceSchema.extend({
  "@type": z.enum(["GovernanceMetadata", "Other", "RelevantArticles"]),
});

const InternalVoteSchema = z.object({
  constitutional: z.number().int().nonnegative().optional(),
  unconstitutional: z.number().int().nonnegative().optional(),
  abstain: z.number().int().nonnegative().optional(),
  didNotVote: z.number().int().nonnegative().optional(),
  againstVote: z.number().int().nonnegative().optional(),
});

export const Cip136BodySchema = z.object({
  summary: z.string().max(300),
  rationaleStatement: z.string(),
  precedentDiscussion: z.string().optional(),
  counterargumentDiscussion: z.string().optional(),
  conclusion: z.string().optional(),
  internalVote: InternalVoteSchema.optional(),
  references: z.array(Cip136ReferenceSchema).optional(),
  comment: z.string().optional(),
  externalUpdates: z.array(ExternalUpdateSchema).optional(),
  onChain: OnChainSchema.optional(),
}).passthrough();

export const Cip136DocumentSchema = z.object({
  "@context": z.unknown(),
  "@type": z.string().optional(),
  "@language": z.string().optional(),
  hashAlgorithm: z.literal("blake2b-256"),
  authors: z.array(AuthorSchema).optional(),
  body: Cip136BodySchema,
}).passthrough();
