import { z } from "zod";
import {
  AuthorSchema,
  ExternalUpdateSchema,
  HashedReferenceSchema,
} from "../core/schemas.js";
import { OnChainSchema } from "../cip169/schemas.js";

export const Cip108BodySchema = z.object({
  title: z.string().max(80),
  abstract: z.string().max(2500),
  motivation: z.string(),
  rationale: z.string(),
  references: z.array(HashedReferenceSchema).optional(),
  comment: z.string().optional(),
  externalUpdates: z.array(ExternalUpdateSchema).optional(),
  onChain: OnChainSchema.optional(),
}).passthrough();

export const Cip108DocumentSchema = z.object({
  "@context": z.unknown(),
  "@type": z.string().optional(),
  "@language": z.string().optional(),
  hashAlgorithm: z.literal("blake2b-256"),
  authors: z.array(AuthorSchema).optional(),
  body: Cip108BodySchema,
}).passthrough();
