import { z } from "zod";
import { AuthorSchema, ExternalUpdateSchema } from "../core/schemas.js";

const Cip119ReferenceSchema = z.object({
  "@type": z.enum(["Link", "Identity", "GovernanceMetadata", "Other"]),
  label: z.string(),
  uri: z.string(),
});

const ImageObjectSchema = z.object({
  "@type": z.literal("ImageObject").optional(),
  contentUrl: z.string(),
  sha256: z.string().optional(),
});

export const Cip119BodySchema = z.object({
  givenName: z.string().max(80),
  image: ImageObjectSchema.optional(),
  objectives: z.string().max(1000).optional(),
  motivations: z.string().max(1000).optional(),
  qualifications: z.string().max(1000).optional(),
  paymentAddress: z.string().optional(),
  doNotList: z.boolean().optional(),
  references: z.array(Cip119ReferenceSchema).optional(),
  comment: z.string().optional(),
  externalUpdates: z.array(ExternalUpdateSchema).optional(),
}).passthrough();

export const Cip119DocumentSchema = z.object({
  "@context": z.unknown(),
  "@type": z.string().optional(),
  "@language": z.string().optional(),
  hashAlgorithm: z.literal("blake2b-256"),
  authors: z.array(AuthorSchema).optional(),
  body: Cip119BodySchema,
}).passthrough();
