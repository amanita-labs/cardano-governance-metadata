import { describe, expect, test } from "bun:test";
import * as ed from "@noble/ed25519";
import { bytesToHex } from "../hex.js";
import { verifyEd25519Signature } from "../verify-signature.js";

async function makeKeyPair(): Promise<{ pub: string; priv: Uint8Array }> {
	const priv = ed.utils.randomPrivateKey();
	const pubBytes = await ed.getPublicKeyAsync(priv);
	return { pub: bytesToHex(pubBytes), priv };
}

async function sign(message: string, priv: Uint8Array): Promise<string> {
	const sig = await ed.signAsync(message, priv);
	return bytesToHex(sig);
}

describe("verifyEd25519Signature", () => {
	test("returns true for a valid signature over the message", async () => {
		const { pub, priv } = await makeKeyPair();
		const message = "deadbeef".repeat(8);
		const signature = await sign(message, priv);
		expect(await verifyEd25519Signature(signature, message, pub)).toBe(true);
	});

	test("returns false when the signature is tampered", async () => {
		const { pub, priv } = await makeKeyPair();
		const message = "deadbeef".repeat(8);
		const signature = await sign(message, priv);
		// flip one bit by xoring the first byte
		const tamperedFirst = (Number.parseInt(signature.slice(0, 2), 16) ^ 0x01)
			.toString(16)
			.padStart(2, "0");
		const tampered = tamperedFirst + signature.slice(2);
		expect(await verifyEd25519Signature(tampered, message, pub)).toBe(false);
	});

	test("returns false when the message is different", async () => {
		const { pub, priv } = await makeKeyPair();
		const message = "deadbeef".repeat(8);
		const signature = await sign(message, priv);
		const otherMessage = "cafef00d".repeat(8);
		expect(await verifyEd25519Signature(signature, otherMessage, pub)).toBe(
			false,
		);
	});

	test("returns false when verifying against a different public key", async () => {
		const { priv } = await makeKeyPair();
		const { pub: otherPub } = await makeKeyPair();
		const message = "deadbeef".repeat(8);
		const signature = await sign(message, priv);
		expect(await verifyEd25519Signature(signature, message, otherPub)).toBe(
			false,
		);
	});
});
