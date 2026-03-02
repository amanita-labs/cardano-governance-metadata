import type {
  Result,
  VerifyInput,
  VerifyOptions,
  VerificationResult,
} from "../core/types.js";
import type { GovernanceMetadataError } from "../core/errors.js";
import { verify as verifyCip100 } from "../cip100/verify.js";

export async function verify(
  input: VerifyInput,
  options?: VerifyOptions,
): Promise<Result<VerificationResult, GovernanceMetadataError>> {
  return verifyCip100(input, options);
}
