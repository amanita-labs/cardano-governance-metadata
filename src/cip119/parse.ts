import { ErrorCode, ParseError, ValidationError } from "../core/errors.js";
import type { ParseOptions, Result } from "../core/types.js";
import { Cip119DocumentSchema } from "./schemas.js";
import type { Cip119Document } from "./types.js";

/**
 * Parse a CIP-119 DRep registration document. Same semantics as
 * `cip100.parse`, but validates the CIP-119 body shape: `givenName`
 * (max 80 chars) plus optional `image`, `objectives`, `motivations`,
 * `qualifications`, `paymentAddress`, `doNotList`.
 */
export function parse(
	input: string | Record<string, unknown>,
	options?: ParseOptions,
): Result<Cip119Document, ParseError | ValidationError> {
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
		return { success: true, data: raw as Cip119Document };
	}

	const result = Cip119DocumentSchema.safeParse(raw);
	if (!result.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(result.error),
		};
	}

	return { success: true, data: result.data as Cip119Document };
}
