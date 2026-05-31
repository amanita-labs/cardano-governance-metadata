import { ErrorCode, ParseError, ValidationError } from "../core/errors.js";
import type { ParseOptions, Result } from "../core/types.js";
import { Cip100DocumentSchema } from "./schemas.js";
import type { Cip100Document } from "./types.js";

/**
 * Parse a CIP-100 governance metadata document from a JSON string or an
 * already-decoded object. Returns a typed document on success or a
 * `ParseError` (malformed JSON) / `ValidationError` (schema violation) on
 * failure.
 *
 * Pass `{ skipValidation: true }` to skip the zod schema check — useful when
 * round-tripping documents you already trust.
 */
export function parse(
	input: string | Record<string, unknown>,
	options?: ParseOptions,
): Result<Cip100Document, ParseError | ValidationError> {
	let raw: unknown;

	if (typeof input === "string") {
		try {
			raw = JSON.parse(input);
		} catch (err) {
			return {
				success: false,
				error: new ParseError(
					ErrorCode.INVALID_JSON,
					`Invalid JSON: ${err}`,
					err,
				),
			};
		}
	} else {
		raw = input;
	}

	if (options?.skipValidation) {
		return { success: true, data: raw as Cip100Document };
	}

	const result = Cip100DocumentSchema.safeParse(raw);
	if (!result.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(result.error),
		};
	}

	return { success: true, data: result.data as Cip100Document };
}
