import { blake2b } from "blakejs";
import { bytesToHex } from "./hex.js";

export function hashBlake2b256(data: Uint8Array): string {
  return bytesToHex(blake2b(data, undefined, 32));
}

export function hashBlake2b256String(text: string): string {
  return hashBlake2b256(new TextEncoder().encode(text));
}
