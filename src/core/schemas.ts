import { z } from "zod";

export const HashAlgorithmSchema = z.literal("blake2b-256");

export const WitnessAlgorithmSchema = z.literal("ed25519");

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
