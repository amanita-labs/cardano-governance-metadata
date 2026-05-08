import { ErrorCode, GovernanceMetadataError } from "../../core/errors.js";

/**
 * Structural surface of the Cardano Serialization Library (CSL) — only the
 * accessors this library actually uses are typed. Any object that satisfies
 * this shape is accepted, which means callers may inject CSL
 * (`@emurgo/cardano-serialization-lib-{nodejs,browser,asmjs}`) or the
 * API-compatible Cardano Multiplatform Library (CML).
 *
 * The internal `any` casts are intentional: the upstream `.d.ts` exports
 * thousands of classes we do not need, and reproducing them here would dwarf
 * the rest of the module without any safety benefit at this layer.
 */
// biome-ignore lint/suspicious/noExplicitAny: structural duck-type for CSL/CML
export type CardanoSerializationLib = any;

let cslHandle: CardanoSerializationLib | null = null;

export function setCardanoSerializationLib(lib: CardanoSerializationLib): void {
  cslHandle = lib;
}

export function getCardanoSerializationLib(): CardanoSerializationLib | null {
  return cslHandle;
}

export function requireCsl(): CardanoSerializationLib {
  if (!cslHandle) {
    throw new GovernanceMetadataError(
      ErrorCode.CSL_NOT_INITIALIZED,
      "Cardano Serialization Library is not initialized. Call cip169.setCardanoSerializationLib(CSL) once at startup before invoking verifyAgainstTx() or decodeConwayTx(). Pick the build that matches your environment: @emurgo/cardano-serialization-lib-nodejs, -browser, or -asmjs (or @dcspark/cardano-multiplatform-lib-*).",
    );
  }
  return cslHandle;
}
