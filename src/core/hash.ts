import { blake2b } from "blakejs";
import { bytesToHex } from "./hex.js";

/**
 * Compute a BLAKE2b-256 (32-byte) hash of `data` and return it as a
 * lowercase hex string. This is the canonical anchor-hash algorithm used
 * by every CIP-100 governance metadata document.
 *
 * @example
 * hashBlake2b256(rawBytes) // => "7b7d4a28a599..."
 */
export function hashBlake2b256(data: Uint8Array): string {
	return bytesToHex(blake2b(data, undefined, 32));
}

/**
 * Convenience wrapper: UTF-8 encode `text`, then `hashBlake2b256` it.
 * Used internally for hashing canonicalized N-Quads before signing.
 */
export function hashBlake2b256String(text: string): string {
	return hashBlake2b256(new TextEncoder().encode(text));
}
