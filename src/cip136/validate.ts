import type { Result } from "../core/types.js";
import { ValidationError } from "../core/errors.js";
import type { Cip136Document } from "./types.js";
import { Cip136DocumentSchema } from "./schemas.js";

export function validate(
  document: unknown,
): Result<Cip136Document, ValidationError> {
  const result = Cip136DocumentSchema.safeParse(document);
  if (!result.success) {
    return {
      success: false,
      error: ValidationError.fromZodError(result.error),
    };
  }
  return { success: true, data: result.data as Cip136Document };
}
