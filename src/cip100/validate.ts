import type { Result } from "../core/types.js";
import { ValidationError } from "../core/errors.js";
import type { Cip100Document } from "./types.js";
import { Cip100DocumentSchema } from "./schemas.js";

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
