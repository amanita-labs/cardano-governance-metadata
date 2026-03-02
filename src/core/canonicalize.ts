import jsonld from "jsonld";
import type { Result } from "./types.js";
import { ErrorCode, VerificationError } from "./errors.js";
import { createDocumentLoader, type DocumentLoader } from "./context.js";

export interface CanonicalizeOptions {
  documentLoader?: DocumentLoader;
}

export async function canonicalizeBody(
  document: Record<string, unknown>,
  options?: CanonicalizeOptions,
): Promise<Result<string, VerificationError>> {
  try {
    const documentLoader =
      options?.documentLoader ?? createDocumentLoader();

    // Canonicalize the full document to N-Quads using URDNA2015
    const canonicalized = await jsonld.canonize(document, {
      algorithm: "URDNA2015",
      format: "application/n-quads",
      documentLoader,
    });

    // Ensure it ends with a newline
    const nquads =
      typeof canonicalized === "string" ? canonicalized : String(canonicalized);

    const result = nquads.endsWith("\n") || nquads === "" ? nquads : nquads + "\n";

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: new VerificationError(
        ErrorCode.CANONICALIZATION_FAILED,
        `Failed to canonicalize document: ${err}`,
        err,
      ),
    };
  }
}
