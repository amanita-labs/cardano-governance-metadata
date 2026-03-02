import { verify } from "@noble/ed25519";
import { hexToBytes } from "./hex.js";

export async function verifyEd25519Signature(
  signature: string,
  message: string,
  publicKey: string,
): Promise<boolean> {
  const sigBytes = hexToBytes(signature);
  const msgBytes = hexToBytes(message);
  const pubBytes = hexToBytes(publicKey);
  return verify(sigBytes, msgBytes, pubBytes);
}
