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
	return verifyCip100(input, options);
}
