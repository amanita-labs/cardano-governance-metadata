import type { Result } from "../core/types.js";
import { ValidationError } from "../core/errors.js";
import type { Cip119Document } from "./types.js";
import { Cip119DocumentSchema } from "./schemas.js";

export function validate(
  document: unknown,
): Result<Cip119Document, ValidationError> {
  const result = Cip119DocumentSchema.safeParse(document);
  if (!result.success) {
    return {
      success: false,
      error: ValidationError.fromZodError(result.error),
    };
  }
  return { success: true, data: result.data as Cip119Document };
}
