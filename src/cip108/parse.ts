import { ErrorCode, ParseError, ValidationError } from "../core/errors.js";
import type { ParseOptions, Result } from "../core/types.js";
import { Cip108DocumentSchema } from "./schemas.js";
import type { Cip108Document } from "./types.js";

/**
 * Parse a CIP-108 governance action document. Same semantics as
 * `cip100.parse`, but validates the CIP-108 body shape: `title` (max 80
 * chars), `abstract` (max 2500), `motivation`, `rationale`.
 */
export function parse(
	input: string | Record<string, unknown>,
	options?: ParseOptions,
): Result<Cip108Document, ParseError | ValidationError> {
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
		return { success: true, data: raw as Cip108Document };
	}

	const result = Cip108DocumentSchema.safeParse(raw);
	if (!result.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(result.error),
		};
	}

	return { success: true, data: result.data as Cip108Document };
}
