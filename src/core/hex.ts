/**
 * Encode a `Uint8Array` as a lowercase hex string with no `0x` prefix.
 *
 * @example
 * bytesToHex(new Uint8Array([0xde, 0xad])) // => "dead"
 */
export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Decode a hex string into a `Uint8Array`. Accepts upper or lower case.
 * Does not strip a `0x` prefix.
 *
 * Throws `TypeError` on odd-length input or non-hex characters — callers
 * receiving untrusted input (e.g. fields from CIP-100 witness JSON) should
 * either catch this or validate beforehand. Returning silently-corrupt bytes
 * would let malformed witnesses be indistinguishable from cryptographic
 * verification failures.
 *
 * @example
 * hexToBytes("DEAD") // => Uint8Array [ 0xde, 0xad ]
 */
export function hexToBytes(hex: string): Uint8Array {
	const len = hex.length;
	if (len % 2 !== 0) {
		throw new TypeError(
			`hexToBytes: expected even-length hex string, got length ${len}`,
		);
	}
	const bytes = new Uint8Array(len / 2);
	for (let i = 0; i < len; i += 2) {
		const high = hexNibble(hex.charCodeAt(i));
		const low = hexNibble(hex.charCodeAt(i + 1));
		if (high < 0 || low < 0) {
			throw new TypeError(
				`hexToBytes: invalid hex character at position ${high < 0 ? i : i + 1}`,
			);
		}
		bytes[i / 2] = (high << 4) | low;
	}
	return bytes;
}

function hexNibble(code: number): number {
	if (code >= 0x30 && code <= 0x39) return code - 0x30; // 0-9
	if (code >= 0x61 && code <= 0x66) return code - 0x61 + 10; // a-f
	if (code >= 0x41 && code <= 0x46) return code - 0x41 + 10; // A-F
	return -1;
}
