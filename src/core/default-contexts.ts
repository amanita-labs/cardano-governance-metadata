/**
 * Canonical JSON-LD `@context` URLs for each supported CIP. These are the
 * exact URLs the `cipNNN.build` factories inject by default and are also
 * resolved offline by the bundled document loader (see `./context.ts`).
 *
 * Callers can override the default by passing `context` to `build`.
 */

export const CIP100_CONTEXT_URL =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld";

export const CIP108_CONTEXT_URL =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0108/cip-0108.common.jsonld";

export const CIP119_CONTEXT_URL =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0119/cip-0119.common.jsonld";

export const CIP136_CONTEXT_URL =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-0136.common.jsonld";

export const CIP169_CONTEXT_URL =
	"https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0169/cip-0169.common.jsonld";
