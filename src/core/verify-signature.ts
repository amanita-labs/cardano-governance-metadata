import { verifyAsync } from "@noble/ed25519";
import { hexToBytes } from "./hex.js";

/**
 * Verify an Ed25519 signature using `@noble/ed25519`'s async path.
 *
 * @param signature  Hex-encoded ed25519 signature (64 bytes / 128 hex chars).
 * @param message    Hex-encoded message that was signed. For CIP-100 witnesses
 *                   this is the hex of `blake2b256(canonicalized N-Quads of
 *                   the body envelope)`.
 * @param publicKey  Hex-encoded ed25519 public key (32 bytes / 64 hex chars).
 * @returns `true` if the signature is valid, `false` otherwise. Never throws —
 *          malformed inputs return `false`.
 */
export async function verifyEd25519Signature(
	signature: string,
	message: string,
	publicKey: string,
): Promise<boolean> {
	try {
		const sigBytes = hexToBytes(signature);
		const msgBytes = hexToBytes(message);
		const pubBytes = hexToBytes(publicKey);
		return await verifyAsync(sigBytes, msgBytes, pubBytes);
	} catch {
		return false;
	}
}
