import { CIP136_CONTEXT_URL } from "../core/default-contexts.js";
import { ValidationError } from "../core/errors.js";
import type { Author, HashAlgorithm, Result } from "../core/types.js";
import { Cip136DocumentSchema } from "./schemas.js";
import type { Cip136Body, Cip136Document } from "./types.js";

export interface BuildCip136Input {
	body: Cip136Body;
	authors?: Author[];
	context?: unknown;
	hashAlgorithm?: HashAlgorithm;
}

export interface BuildCip136Output {
	doc: Cip136Document;
	json: string;
}

/**
 * Construct a CIP-136 constitutional-committee vote-rationale document.
 *
 * Auto-injects the canonical CIP-136 `@context` URL and
 * `hashAlgorithm: "blake2b-256"` — both overridable. Body must include
 * `summary` (≤ 300 chars) and `rationaleStatement`.
 */
export function build(
	input: BuildCip136Input,
): Result<BuildCip136Output, ValidationError> {
	const envelope: Record<string, unknown> = {
		"@context": input.context ?? CIP136_CONTEXT_URL,
		hashAlgorithm: input.hashAlgorithm ?? "blake2b-256",
		body: input.body,
	};
	if (input.authors !== undefined) {
		envelope.authors = input.authors;
	}

	const parsed = Cip136DocumentSchema.safeParse(envelope);
	if (!parsed.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(parsed.error),
		};
	}
	const doc = parsed.data as Cip136Document;
	return {
		success: true,
		data: { doc, json: JSON.stringify(doc, null, 2) },
	};
}
