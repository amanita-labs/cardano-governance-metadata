import { describe, expect, test } from "bun:test";
import { bytesToHex, hexToBytes } from "../hex.js";

describe("bytesToHex", () => {
	test("empty array becomes empty string", () => {
		expect(bytesToHex(new Uint8Array(0))).toBe("");
	});

	test("single byte 0x00 becomes '00'", () => {
		expect(bytesToHex(new Uint8Array([0x00]))).toBe("00");
	});

	test("single byte 0xff becomes 'ff'", () => {
		expect(bytesToHex(new Uint8Array([0xff]))).toBe("ff");
	});

	test("multi-byte known fixture", () => {
		expect(bytesToHex(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe(
			"deadbeef",
		);
	});

	test("output is always lowercase", () => {
		expect(bytesToHex(new Uint8Array([0xab, 0xcd, 0xef]))).toBe("abcdef");
	});
});

describe("hexToBytes", () => {
	test("empty string becomes empty array", () => {
		expect(hexToBytes("")).toEqual(new Uint8Array(0));
	});

	test("lowercase hex parses correctly", () => {
		expect(hexToBytes("deadbeef")).toEqual(
			new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
		);
	});

	test("uppercase hex parses correctly", () => {
		expect(hexToBytes("DEADBEEF")).toEqual(
			new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
		);
	});

	test("mixed case hex parses correctly", () => {
		expect(hexToBytes("DeAdBeEf")).toEqual(
			new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
		);
	});

	test("64-char hash decodes to 32 bytes", () => {
		const hash = "ab".repeat(32);
		const bytes = hexToBytes(hash);
		expect(bytes.length).toBe(32);
		expect(bytes[0]).toBe(0xab);
		expect(bytes[31]).toBe(0xab);
	});
});

describe("hex round-trip", () => {
	test("bytesToHex(hexToBytes(x)) preserves input", () => {
		const inputs = [
			"",
			"00",
			"ff",
			"deadbeef",
			"ab".repeat(32),
			"0123456789abcdef",
		];
		for (const input of inputs) {
			expect(bytesToHex(hexToBytes(input))).toBe(input);
		}
	});

	test("hexToBytes(bytesToHex(b)) preserves input", () => {
		const inputs = [
			new Uint8Array(0),
			new Uint8Array([0]),
			new Uint8Array([0xff]),
			new Uint8Array([0x00, 0x01, 0x02, 0x03]),
			new Uint8Array(64).map((_, i) => i),
		];
		for (const input of inputs) {
			expect(hexToBytes(bytesToHex(input))).toEqual(input);
		}
	});
});
