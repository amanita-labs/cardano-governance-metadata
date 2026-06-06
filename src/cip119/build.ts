import { CIP119_CONTEXT_URL } from "../core/default-contexts.js";
import { ValidationError } from "../core/errors.js";
import type { Author, HashAlgorithm, Result } from "../core/types.js";
import { Cip119DocumentSchema } from "./schemas.js";
import type { Cip119Body, Cip119Document } from "./types.js";

export interface BuildCip119Input {
	body: Cip119Body;
	authors?: Author[];
	context?: unknown;
	hashAlgorithm?: HashAlgorithm;
}

export interface BuildCip119Output {
	doc: Cip119Document;
	json: string;
}

/**
 * Construct a CIP-119 DRep metadata document.
 *
 * Auto-injects the canonical CIP-119 `@context` URL and
 * `hashAlgorithm: "blake2b-256"` — both overridable. Body must include at
 * least `givenName` (≤ 80 chars); the rest is optional per the spec.
 */
export function build(
	input: BuildCip119Input,
): Result<BuildCip119Output, ValidationError> {
	const envelope: Record<string, unknown> = {
		"@context": input.context ?? CIP119_CONTEXT_URL,
		hashAlgorithm: input.hashAlgorithm ?? "blake2b-256",
		body: input.body,
	};
	if (input.authors !== undefined) {
		envelope.authors = input.authors;
	}

	const parsed = Cip119DocumentSchema.safeParse(envelope);
	if (!parsed.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(parsed.error),
		};
	}
	const doc = parsed.data as Cip119Document;
	return {
		success: true,
		data: { doc, json: JSON.stringify(doc, null, 2) },
	};
}
