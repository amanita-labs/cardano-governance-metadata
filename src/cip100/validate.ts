import { ValidationError } from "../core/errors.js";
import type { Result } from "../core/types.js";
import { Cip100DocumentSchema } from "./schemas.js";
import type { Cip100Document } from "./types.js";

/**
 * Validate an unknown value against the CIP-100 zod schema. On failure,
 * `error.issues` carries one entry per problem with `path`, `message`, and
 * `code`. Extra fields are preserved (passthrough).
 */
export function validate(
	document: unknown,
): Result<Cip100Document, ValidationError> {
	const result = Cip100DocumentSchema.safeParse(document);
	if (!result.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(result.error),
		};
	}
	return { success: true, data: result.data as Cip100Document };
}
