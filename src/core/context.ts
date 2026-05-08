import type { JsonLd, RemoteDocument } from "jsonld/jsonld-spec";
import type {
  ContextPolicy,
  ContextResolutionOptions,
  RemoteContextDocument,
} from "./types.js";
import { ErrorCode, ParseError } from "./errors.js";

export type DocumentLoader = (
  url: string,
  callback: (err: Error, remoteDoc: RemoteDocument) => void,
) => Promise<RemoteDocument>;

type LoaderResult = Promise<RemoteDocument>;
export type DocumentLoaderFn = (url: string) => LoaderResult;

interface BundleEntry {
  name: string;
  load: () => Promise<object>;
}

const BUNDLED_LOADERS: Record<string, () => Promise<object>> = {
  "cip-0100": async () =>
    (await import("../../contexts/cip-0100.common.jsonld")).default,
  "cip-0108": async () =>
    (await import("../../contexts/cip-0108.common.jsonld")).default,
  "cip-0119": async () =>
    (await import("../../contexts/cip-0119.common.jsonld")).default,
  "cip-0136": async () =>
    (await import("../../contexts/cip-0136.common.jsonld")).default,
  "cip-0169": async () =>
    (await import("../../contexts/cip-0169.common.jsonld")).default,
};

const BUNDLED_URLS: Record<string, BundleEntry> = makeBundledUrls();

function makeBundledUrls(): Record<string, BundleEntry> {
  const entries: Record<string, BundleEntry> = {};

  const cipFiles: Array<{
    cip: string;
    name: string;
    canonicalFilename: string;
    extraFilenames?: string[];
  }> = [
    { cip: "0100", name: "cip-0100", canonicalFilename: "cip-0100.common.jsonld" },
    { cip: "0108", name: "cip-0108", canonicalFilename: "cip-0108.common.jsonld" },
    { cip: "0119", name: "cip-0119", canonicalFilename: "cip-0119.common.jsonld" },
    {
      cip: "0136",
      name: "cip-0136",
      canonicalFilename: "cip-0136.common.jsonld",
      extraFilenames: ["cip-136.common.jsonld"],
    },
    { cip: "0169", name: "cip-0169", canonicalFilename: "cip-0169.common.jsonld" },
  ];

  for (const { cip, name, canonicalFilename, extraFilenames } of cipFiles) {
    const filenames = [canonicalFilename, ...(extraFilenames ?? [])];
    for (const filename of filenames) {
      const urls = [
        `https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-${cip}/${filename}`,
        `https://github.com/cardano-foundation/CIPs/blob/master/CIP-${cip}/${filename}`,
        `https://github.com/cardano-foundation/CIPs/raw/master/CIP-${cip}/${filename}`,
      ];
      for (const url of urls) {
        entries[url] = { name, load: BUNDLED_LOADERS[name] };
      }
    }
  }

  return entries;
}

const runtimeBundles = new Map<string, object>();
const contextCache = new Map<string, object>();

export function registerContext(url: string, document: object): void {
  runtimeBundles.set(url, document);
}

export function unregisterContext(url: string): boolean {
  return runtimeBundles.delete(url);
}

export function clearRegisteredContexts(): void {
  runtimeBundles.clear();
}

export function listBundledContextUrls(): string[] {
  return [...Object.keys(BUNDLED_URLS), ...runtimeBundles.keys()];
}

const DEFAULT_POLICY: ContextPolicy = "allowlist";

export function createDocumentLoader(
  options?: ContextResolutionOptions,
): DocumentLoaderFn {
  const policy: ContextPolicy = options?.policy ?? DEFAULT_POLICY;
  const overrides = options?.overrides ?? {};
  const allowlist = options?.allowlist ?? [];
  const fetchImpl = options?.fetch ?? globalThis.fetch;
  const cache = options?.cache ?? new Map<string, RemoteContextDocument>();

  return async (url: string): Promise<RemoteDocument> => {
    if (Object.prototype.hasOwnProperty.call(overrides, url)) {
      return wrap(url, overrides[url]);
    }

    if (runtimeBundles.has(url)) {
      return wrap(url, runtimeBundles.get(url)!);
    }

    const bundled = BUNDLED_URLS[url];
    if (bundled) {
      const cached = contextCache.get(bundled.name);
      if (cached) return wrap(url, cached);
      const doc = await bundled.load();
      contextCache.set(bundled.name, doc);
      return wrap(url, doc);
    }

    if (policy === "bundled-only") {
      throw new ParseError(
        ErrorCode.MISSING_CONTEXT,
        `JSON-LD @context "${url}" is not bundled. Either register it via registerContext() / contextOptions.overrides, or set contextOptions.policy = "allowlist" with a matching pattern, or "fetch".`,
      );
    }

    if (policy === "allowlist") {
      if (!matchesAllowlist(url, allowlist)) {
        throw new ParseError(
          ErrorCode.MISSING_CONTEXT,
          `JSON-LD @context "${url}" is not bundled and does not match contextOptions.allowlist. Add a pattern to allowlist (string with * or ** globs, or a RegExp), pass it via contextOptions.overrides, or use contextOptions.policy = "fetch".`,
        );
      }
    }

    const cached = cache.get(url);
    if (cached) return wrap(cached.documentUrl, cached.document as object);

    if (!fetchImpl) {
      throw new ParseError(
        ErrorCode.MISSING_CONTEXT,
        `Cannot fetch JSON-LD @context "${url}" — no fetch implementation available. Pass contextOptions.fetch or run in an environment with globalThis.fetch.`,
      );
    }

    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new ParseError(
        ErrorCode.MISSING_CONTEXT,
        `Failed to fetch JSON-LD @context "${url}": HTTP ${response.status} ${response.statusText}`,
      );
    }
    const document = (await response.json()) as JsonLd;
    cache.set(url, { contextUrl: undefined, documentUrl: url, document });
    return wrap(url, document as unknown as object);
  };
}

function wrap(url: string, document: object): RemoteDocument {
  return {
    contextUrl: undefined,
    document: document as JsonLd,
    documentUrl: url,
  };
}

function matchesAllowlist(
  url: string,
  patterns: (string | RegExp)[],
): boolean {
  for (const pattern of patterns) {
    if (typeof pattern === "string") {
      if (pattern === url) return true;
      if (globToRegExp(pattern).test(url)) return true;
    } else if (pattern.test(url)) {
      return true;
    }
  }
  return false;
}

function globToRegExp(glob: string): RegExp {
  // Translate ** → .*, * → [^/]*, escape everything else.
  let i = 0;
  let out = "";
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 2;
      } else {
        out += "[^/]*";
        i += 1;
      }
    } else if (/[.+?^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return new RegExp(`^${out}$`);
}
