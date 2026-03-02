import type {
  CipStandard,
  ExtraFieldInfo,
  ResolvedMetadata,
  ResolveOptions,
  Result,
} from "./core/types.js";
import {
  ErrorCode,
  GovernanceMetadataError,
  ParseError,
} from "./core/errors.js";
import { fetchMetadata } from "./core/fetcher.js";
import { detectCipStandard } from "./detect.js";
import { parse as parseCip100 } from "./cip100/parse.js";
import { parse as parseCip108 } from "./cip108/parse.js";
import { parse as parseCip119 } from "./cip119/parse.js";
import { parse as parseCip136 } from "./cip136/parse.js";
import { verify as verifyCip100 } from "./cip100/verify.js";

const KNOWN_DOCUMENT_FIELDS = new Set([
  "@context", "@type", "@language", "hashAlgorithm", "authors", "body",
]);

const KNOWN_BODY_FIELDS: Record<CipStandard, Set<string>> = {
  "CIP-100": new Set([
    "references", "comment", "externalUpdates",
  ]),
  "CIP-108": new Set([
    "references", "comment", "externalUpdates",
    "title", "abstract", "motivation", "rationale",
  ]),
  "CIP-119": new Set([
    "references", "comment", "externalUpdates",
    "givenName", "image", "objectives", "motivations",
    "qualifications", "paymentAddress", "doNotList",
  ]),
  "CIP-136": new Set([
    "references", "comment", "externalUpdates",
    "summary", "rationaleStatement", "precedentDiscussion",
    "counterargumentDiscussion", "conclusion", "internalVote",
  ]),
};

function collectExtraFields(
  document: Record<string, unknown>,
  cipStandard: CipStandard,
): ExtraFieldInfo[] {
  const extras: ExtraFieldInfo[] = [];

  for (const key of Object.keys(document)) {
    if (!KNOWN_DOCUMENT_FIELDS.has(key)) {
      extras.push({ path: key, value: document[key] });
    }
  }

  const body = document.body;
  if (body && typeof body === "object") {
    const knownBodyFields = KNOWN_BODY_FIELDS[cipStandard];
    for (const key of Object.keys(body)) {
      if (!knownBodyFields.has(key)) {
        extras.push({
          path: `body.${key}`,
          value: (body as Record<string, unknown>)[key],
        });
      }
    }
  }

  return extras;
}

/**
 * Fetch metadata from a URI, detect which CIP standard it conforms to,
 * parse and validate it, and optionally verify anchor hash + signatures.
 *
 * Returns the typed document, detected standard, any extra fields present,
 * and verification results.
 */
export async function resolve(
  uri: string,
  options?: ResolveOptions,
): Promise<Result<ResolvedMetadata, GovernanceMetadataError>> {
  // 1. Fetch raw bytes
  const fetchResult = await fetchMetadata(uri, options?.fetchOptions);
  if (!fetchResult.success) return fetchResult;
  const rawBytes = fetchResult.data;

  // 2. Parse JSON
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(new TextDecoder().decode(rawBytes));
  } catch (err) {
    return {
      success: false,
      error: new ParseError(
        ErrorCode.INVALID_JSON,
        `Invalid JSON: ${err}`,
        err,
      ),
    };
  }

  // 3. Detect CIP standard
  const cipStandard = detectCipStandard(raw);
  if (!cipStandard) {
    return {
      success: false,
      error: new ParseError(
        ErrorCode.INVALID_JSONLD,
        "Could not detect CIP standard: document does not match any known CIP body shape",
      ),
    };
  }

  // 4. Parse + validate with the correct CIP schema
  const parseResult = (() => {
    switch (cipStandard) {
      case "CIP-108": return parseCip108(raw);
      case "CIP-119": return parseCip119(raw);
      case "CIP-136": return parseCip136(raw);
      default:        return parseCip100(raw);
    }
  })();

  if (!parseResult.success) return parseResult;

  // 5. Collect extra fields not defined by the detected CIP
  const extraFields = collectExtraFields(raw, cipStandard);

  // 6. Optionally verify (anchor hash + witness signatures)
  let verification = undefined;
  if (!options?.skipVerification) {
    const verifyResult = await verifyCip100(
      { document: raw, rawBytes },
      {
        anchorHash: options?.anchorHash,
        fetchOptions: options?.fetchOptions,
      },
    );
    if (verifyResult.success) {
      verification = verifyResult.data;
    }
  }

  return {
    success: true,
    data: {
      cipStandard,
      document: parseResult.data as unknown as Record<string, unknown>,
      rawBytes,
      extraFields,
      verification,
    },
  };
}
