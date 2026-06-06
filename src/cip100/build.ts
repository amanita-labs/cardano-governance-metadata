import { CIP100_CONTEXT_URL } from "../core/default-contexts.js";
import { ValidationError } from "../core/errors.js";
import type { Author, HashAlgorithm, Result } from "../core/types.js";
import { Cip100DocumentSchema } from "./schemas.js";
import type { Cip100Body, Cip100Document } from "./types.js";

export interface BuildCip100Input {
	body: Cip100Body;
	authors?: Author[];
	context?: unknown;
	hashAlgorithm?: HashAlgorithm;
}

export interface BuildCip100Output {
	doc: Cip100Document;
	json: string;
}

/**
 * Construct a CIP-100 governance metadata document (the base envelope).
 * See `cip108.build` / `cip119.build` / etc. for richer per-CIP shapes.
 */
export function build(
	input: BuildCip100Input,
): Result<BuildCip100Output, ValidationError> {
	const envelope: Record<string, unknown> = {
		"@context": input.context ?? CIP100_CONTEXT_URL,
		hashAlgorithm: input.hashAlgorithm ?? "blake2b-256",
		body: input.body,
	};
	if (input.authors !== undefined) {
		envelope.authors = input.authors;
	}

	const parsed = Cip100DocumentSchema.safeParse(envelope);
	if (!parsed.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(parsed.error),
		};
	}
	const doc = parsed.data as Cip100Document;
	return {
		success: true,
		data: { doc, json: JSON.stringify(doc, null, 2) },
	};
}
