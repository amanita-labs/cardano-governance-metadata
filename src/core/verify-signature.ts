import { verifyAsync } from "@noble/ed25519";
import { hexToBytes } from "./hex.js";

/**
 * Verify an Ed25519 signature using `@noble/ed25519`'s async path.
 *
 * Each argument may be hex-encoded or raw bytes; hex is decoded, bytes are
 * passed through as-is.
 *
 * @param signature  Ed25519 signature (64 bytes / 128 hex chars).
 * @param message    Message that was signed. For CIP-100 witnesses this is
 *                   `blake2b256(canonicalized N-Quads of the body envelope)`.
 * @param publicKey  Ed25519 public key (32 bytes / 64 hex chars).
 * @returns `true` if the signature is valid, `false` otherwise. Never throws —
 *          malformed inputs return `false`.
 */
export async function verifyEd25519Signature(
	signature: string | Uint8Array,
	message: string | Uint8Array,
	publicKey: string | Uint8Array,
): Promise<boolean> {
	try {
		const sigBytes =
			typeof signature === "string" ? hexToBytes(signature) : signature;
		const msgBytes =
			typeof message === "string" ? hexToBytes(message) : message;
		const pubBytes =
			typeof publicKey === "string" ? hexToBytes(publicKey) : publicKey;
		return await verifyAsync(sigBytes, msgBytes, pubBytes);
	} catch {
		return false;
	}
}
