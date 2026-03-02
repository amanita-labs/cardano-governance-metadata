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
  // CIP-108 verification follows the same pipeline as CIP-100.
  // The base verify handles anchor hash check, canonicalization, and signature verification.
  // CIP-108-specific field validation is handled by parse/validate.
  return verifyCip100(input, options);
}
