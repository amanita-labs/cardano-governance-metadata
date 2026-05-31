import { ValidationError } from "../core/errors.js";
import type { Result } from "../core/types.js";
import { OnChainSchema } from "./schemas.js";
import type { OnChain } from "./types.js";

/**
 * Validate an unknown value against the CIP-169 `OnChain` schema (a union
 * of proposal procedure / certificate / voting procedures shapes). Useful
 * when you've already parsed JSON yourself and want a typed result.
 */
export function validate(input: unknown): Result<OnChain, ValidationError> {
	const result = OnChainSchema.safeParse(input);
	if (!result.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(result.error),
		};
	}
	return { success: true, data: result.data as OnChain };
}
