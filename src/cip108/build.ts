import { CIP108_CONTEXT_URL } from "../core/default-contexts.js";
import { ValidationError } from "../core/errors.js";
import type { Author, HashAlgorithm, Result } from "../core/types.js";
import { Cip108DocumentSchema } from "./schemas.js";
import type { Cip108Body, Cip108Document } from "./types.js";

export interface BuildCip108Input {
	body: Cip108Body;
	authors?: Author[];
	context?: unknown;
	hashAlgorithm?: HashAlgorithm;
}

export interface BuildCip108Output {
	doc: Cip108Document;
	json: string;
}

/**
 * Construct a CIP-108 governance action proposal document.
 *
 * Auto-injects the canonical CIP-108 `@context` URL and the
 * `hashAlgorithm: "blake2b-256"` default; both can be overridden via the
 * `context` / `hashAlgorithm` fields. The result is validated by the same
 * Zod schema that `validate()` uses, so a successful build is guaranteed
 * to round-trip through `parse()`.
 *
 * Returns `Result<{ doc, json }>` where `json` is `JSON.stringify(doc, null, 2)`.
 *
 * Witnesses are out of scope: callers compose `authors[]` themselves (with
 * or without populated witnesses).
 */
export function build(
	input: BuildCip108Input,
): Result<BuildCip108Output, ValidationError> {
	const envelope: Record<string, unknown> = {
		"@context": input.context ?? CIP108_CONTEXT_URL,
		hashAlgorithm: input.hashAlgorithm ?? "blake2b-256",
		body: input.body,
	};
	if (input.authors !== undefined) {
		envelope.authors = input.authors;
	}

	const parsed = Cip108DocumentSchema.safeParse(envelope);
	if (!parsed.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(parsed.error),
		};
	}
	const doc = parsed.data as Cip108Document;
	return {
		success: true,
		data: { doc, json: JSON.stringify(doc, null, 2) },
	};
}
