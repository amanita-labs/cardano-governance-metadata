import type {
  Result,
  VerifyInput,
  VerifyOptions,
  VerificationResult,
  WitnessVerificationResult,
} from "../core/types.js";
import {
  ErrorCode,
  GovernanceMetadataError,
  ParseError,
} from "../core/errors.js";
import { fetchMetadata } from "../core/fetcher.js";
import { hashBlake2b256 } from "../core/hash.js";
import { canonicalizeBody } from "../core/canonicalize.js";
import { verifyEd25519Signature } from "../core/verify-signature.js";
import { hashBlake2b256String } from "../core/hash.js";
import { parse } from "./parse.js";
import type { Cip100Document } from "./types.js";

export async function verify(
  input: VerifyInput,
  options?: VerifyOptions,
): Promise<Result<VerificationResult, GovernanceMetadataError>> {
  let rawBytes: Uint8Array | undefined;
  let document: Record<string, unknown>;

  // Step 1: Resolve input to raw bytes and/or parsed document
  if ("uri" in input) {
    const fetchResult = await fetchMetadata(input.uri, options?.fetchOptions);
    if (!fetchResult.success) return fetchResult;
    rawBytes = fetchResult.data;
  } else if ("rawBytes" in input) {
    rawBytes = input.rawBytes;
  } else {
    document = input.document;
    rawBytes = input.rawBytes;
  }

  // Step 2: Parse if we only have raw bytes
  if (!("document" in input) || !input.document) {
    if (!rawBytes) {
      return {
        success: false,
        error: new ParseError(ErrorCode.INVALID_JSON, "No input provided"),
      };
    }
    const text = new TextDecoder().decode(rawBytes);
    const parseResult = parse(text);
    if (!parseResult.success) return parseResult;
    document = parseResult.data as unknown as Record<string, unknown>;
  } else {
    document = input.document;
  }

  // Step 3: Check anchor hash if provided
  let anchorHash: VerificationResult["anchorHash"];
  if (options?.anchorHash && rawBytes) {
    const computed = hashBlake2b256(rawBytes);
    anchorHash = {
      valid: computed === options.anchorHash,
      expected: options.anchorHash,
      computed,
    };
  }

  // Step 4: Verify witness signatures
  const witnesses: WitnessVerificationResult[] = [];

  if (!options?.skipWitnessVerification) {
    const doc = document as unknown as Cip100Document;
    const authors = doc.authors ?? [];

    for (let i = 0; i < authors.length; i++) {
      const author = authors[i];
      if (!author.witness?.publicKey || !author.witness?.signature) continue;

      // Canonicalize the body
      const canonResult = await canonicalizeBody(document, {
        contextOptions: options?.contextOptions,
      });
      if (!canonResult.success) return canonResult;

      // Hash the canonicalized N-Quads
      const bodyHash = hashBlake2b256String(canonResult.data);

      // Verify ed25519 signature
      const signatureValid = await verifyEd25519Signature(
        author.witness.signature,
        bodyHash,
        author.witness.publicKey,
      );

      witnesses.push({
        authorIndex: i,
        authorName: author.name,
        publicKey: author.witness.publicKey,
        signatureValid,
      });
    }
  }

  const valid =
    (anchorHash?.valid ?? true) &&
    witnesses.every((w) => w.signatureValid);

  return {
    success: true,
    data: { anchorHash, witnesses, valid },
  };
}
