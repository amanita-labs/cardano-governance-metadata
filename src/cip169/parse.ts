import { ErrorCode, ParseError, ValidationError } from "../core/errors.js";
import type { ParseOptions, Result } from "../core/types.js";
import { OnChainSchema } from "./schemas.js";
import type { OnChain } from "./types.js";

/**
 * Parse a CIP-0116-shaped on-chain value (proposal procedure, certificate,
 * or voting procedures array). Accepts a JSON string or an object.
 *
 * This validates only the on-chain payload — for full envelope parsing
 * (with `body.onChain` nested inside a CIP-100/108/119/136 document) use
 * the corresponding `cipNNN.parse`.
 */
export function parse(
	input: string | unknown,
	options?: ParseOptions,
): Result<OnChain, ParseError | ValidationError> {
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
		return { success: true, data: raw as OnChain };
	}

	const result = OnChainSchema.safeParse(raw);
	if (!result.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(result.error),
		};
	}

	return { success: true, data: result.data as OnChain };
}
