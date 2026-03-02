import type { CipStandard } from "./core/types.js";

/**
 * Detect which CIP standard a governance metadata document conforms to,
 * based on the fields present in the body.
 */
export function detectCipStandard(
  document: Record<string, unknown>,
): CipStandard | null {
  const body = document.body;
  if (!body || typeof body !== "object") return null;

  const b = body as Record<string, unknown>;

  // CIP-108: Governance Actions — has title + abstract + motivation + rationale
  if ("title" in b && "abstract" in b && "motivation" in b && "rationale" in b) {
    return "CIP-108";
  }

  // CIP-119: DRep Registration — has givenName
  if ("givenName" in b) {
    return "CIP-119";
  }

  // CIP-136: CC Votes — has summary + rationaleStatement
  if ("summary" in b && "rationaleStatement" in b) {
    return "CIP-136";
  }

  // Fallback: base CIP-100
  if ("hashAlgorithm" in document) {
    return "CIP-100";
  }

  return null;
}
