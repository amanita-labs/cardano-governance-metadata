import { verify as verifyCip100 } from "../cip100/verify.js";
import type { GovernanceMetadataError } from "../core/errors.js";
import type {
	Result,
	VerificationResult,
	VerifyInput,
	VerifyOptions,
} from "../core/types.js";

export async function verify(
	input: VerifyInput,
	options?: VerifyOptions,
): Promise<Result<VerificationResult, GovernanceMetadataError>> {
	// CIP-108 verification follows the same pipeline as CIP-100.
	// The base verify handles anchor hash check, canonicalization, and signature verification.
	// CIP-108-specific field validation is handled by parse/validate.
	return verifyCip100(input, options);
}
