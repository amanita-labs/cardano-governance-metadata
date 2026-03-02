import type { RemoteDocument, JsonLd } from "jsonld/jsonld-spec";

// Context files are loaded lazily to support both Node and browser
const BUNDLED_CONTEXT_URLS: Record<string, string> = {
  "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld":
    "cip-0100",
  "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0108/cip-0108.common.jsonld":
    "cip-0108",
  "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0119/cip-0119.common.jsonld":
    "cip-0119",
  "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-136.common.jsonld":
    "cip-0136",
  // Alternate URL patterns that may appear in the wild
  "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0136/cip-0136.common.jsonld":
    "cip-0136",
};

const contextCache = new Map<string, object>();

async function loadBundledContext(name: string): Promise<object> {
  if (contextCache.has(name)) {
    return contextCache.get(name)!;
  }

  let ctx: object;
  switch (name) {
    case "cip-0100":
      ctx = (await import("../../contexts/cip-0100.common.jsonld")).default;
      break;
    case "cip-0108":
      ctx = (await import("../../contexts/cip-0108.common.jsonld")).default;
      break;
    case "cip-0119":
      ctx = (await import("../../contexts/cip-0119.common.jsonld")).default;
      break;
    case "cip-0136":
      ctx = (await import("../../contexts/cip-0136.common.jsonld")).default;
      break;
    default:
      throw new Error(`Unknown bundled context: ${name}`);
  }

  contextCache.set(name, ctx);
  return ctx;
}

export type DocumentLoader = (
  url: string,
  callback: (err: Error, remoteDoc: RemoteDocument) => void,
) => Promise<RemoteDocument>;

export function createDocumentLoader(
  fallback?: DocumentLoader,
): DocumentLoader {
  return async (url, _callback): Promise<RemoteDocument> => {
    const contextName = BUNDLED_CONTEXT_URLS[url];
    if (contextName) {
      const document = await loadBundledContext(contextName) as JsonLd;
      return {
        contextUrl: undefined,
        document,
        documentUrl: url,
      };
    }

    if (fallback) {
      return fallback(url, _callback);
    }

    // Default: attempt network fetch
    const response = await fetch(url);
    const document = (await response.json()) as JsonLd;
    return {
      contextUrl: undefined,
      document,
      documentUrl: url,
    };
  };
}
