import type { ParseOptions, Result } from "../core/types.js";
import { ErrorCode, ParseError, ValidationError } from "../core/errors.js";
import type { OnChain } from "./types.js";
import { OnChainSchema } from "./schemas.js";

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
