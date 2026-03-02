import type { Result } from "../core/types.js";
import { ValidationError } from "../core/errors.js";
import type { Cip108Document } from "./types.js";
import { Cip108DocumentSchema } from "./schemas.js";

export function validate(
  document: unknown,
): Result<Cip108Document, ValidationError> {
  const result = Cip108DocumentSchema.safeParse(document);
  if (!result.success) {
    return {
      success: false,
      error: ValidationError.fromZodError(result.error),
    };
  }
  return { success: true, data: result.data as Cip108Document };
}
