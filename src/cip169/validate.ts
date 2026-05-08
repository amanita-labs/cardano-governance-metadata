import type { Result } from "../core/types.js";
import { ValidationError } from "../core/errors.js";
import type { OnChain } from "./types.js";
import { OnChainSchema } from "./schemas.js";

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
