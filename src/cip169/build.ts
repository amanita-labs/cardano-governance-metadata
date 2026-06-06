import { ValidationError } from "../core/errors.js";
import type { Result } from "../core/types.js";
import { OnChainSchema } from "./schemas.js";
import type { OnChain } from "./types.js";

export interface BuildCip169Output {
	payload: OnChain;
	json: string;
}

/**
 * Build a CIP-169 on-chain payload — a proposal procedure, a certificate,
 * or a voting procedures array. Validates the input against `OnChainSchema`
 * and returns the typed payload alongside a pretty-printed JSON string.
 *
 * CIP-169 is an extension that nests inside the `body.onChain` field of a
 * CIP-100/108/119/136 document. After building, hand the `payload` to
 * `cipNNN.build({ body: { onChain: payload, ... } })` for a full document.
 *
 * Use the per-action helpers in `./actions.js` to construct the inner
 * `gov_action` / certificate / voter values without hand-writing tags.
 */
export function build(
	input: OnChain,
): Result<BuildCip169Output, ValidationError> {
	const parsed = OnChainSchema.safeParse(input);
	if (!parsed.success) {
		return {
			success: false,
			error: ValidationError.fromZodError(parsed.error),
		};
	}
	const payload = parsed.data as OnChain;
	return {
		success: true,
		data: { payload, json: JSON.stringify(payload, null, 2) },
	};
}
