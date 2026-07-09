import type { JsonLd, RemoteDocument } from "jsonld/jsonld-spec";
import { ErrorCode, ParseError } from "./errors.js";
import type {
	ContextPolicy,
	ContextResolutionOptions,
	RemoteContextDocument,
} from "./types.js";

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

import cip0100Context from "../../contexts/cip-0100.common.jsonld" with {
	type: "json",
};
import cip0108Context from "../../contexts/cip-0108.common.jsonld" with {
	type: "json",
};
import cip0119Context from "../../contexts/cip-0119.common.jsonld" with {
	type: "json",
};
import cip0136Context from "../../contexts/cip-0136.common.jsonld" with {
	type: "json",
};
import cip0169Context from "../../contexts/cip-0169.common.jsonld" with {
	type: "json",
};

const BUNDLED_LOADERS: Record<string, () => Promise<object>> = {
	"cip-0100": async () => cip0100Context as object,
	"cip-0108": async () => cip0108Context as object,
	"cip-0119": async () => cip0119Context as object,
	"cip-0136": async () => cip0136Context as object,
	"cip-0169": async () => cip0169Context as object,
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
		{
			cip: "0100",
			name: "cip-0100",
			canonicalFilename: "cip-0100.common.jsonld",
		},
		{
			cip: "0108",
			name: "cip-0108",
			canonicalFilename: "cip-0108.common.jsonld",
		},
		{
			cip: "0119",
			name: "cip-0119",
			canonicalFilename: "cip-0119.common.jsonld",
		},
		{
			cip: "0136",
			name: "cip-0136",
			canonicalFilename: "cip-0136.common.jsonld",
			extraFilenames: ["cip-136.common.jsonld"],
		},
		{
			cip: "0169",
			name: "cip-0169",
			canonicalFilename: "cip-0169.common.jsonld",
		},
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

/**
 * Register a JSON-LD `@context` document at a URL so canonicalization /
 * verification can resolve it offline. Useful when you want to pin a specific
 * version of a context that isn't bundled with this library.
 *
 * Runtime registrations take precedence over bundled URLs and survive across
 * `createDocumentLoader` calls until `unregisterContext` or
 * `clearRegisteredContexts` is called.
 *
 * @example
 * registerContext(
 *   "https://intersectmbo.github.io/governance-actions/v1.1.0/schemas/.../common.jsonld",
 *   await loadLocalJsonld(),
 * );
 */
export function registerContext(url: string, document: object): void {
	runtimeBundles.set(url, document);
}

/** Remove a previously-registered context. Returns `true` if it was present. */
export function unregisterContext(url: string): boolean {
	return runtimeBundles.delete(url);
}

/** Remove all runtime-registered contexts. Bundled CIP contexts are unaffected. */
export function clearRegisteredContexts(): void {
	runtimeBundles.clear();
}

/**
 * List every URL that resolves offline — the bundled CIP-100/108/119/136/169
 * contexts plus any runtime-registered contexts. Order: bundled first, then
 * registered in insertion order.
 */
export function listBundledContextUrls(): string[] {
	return [...Object.keys(BUNDLED_URLS), ...runtimeBundles.keys()];
}

const DEFAULT_POLICY: ContextPolicy = "allowlist";

/**
 * Context-host patterns trusted by default under the `"allowlist"` policy, in
 * addition to any caller-supplied `allowlist`. These are the official
 * Intersect-hosted governance-actions schemas — published JSON-LD `@context`
 * documents that governance-action metadata references by URL (e.g.
 * `…/governance-actions/v1.2.0/schemas/parameter-changes/common.jsonld`).
 *
 * The host serves them with `Access-Control-Allow-Origin: *`, so they resolve
 * in the browser too. Trusting them here means a document carrying one of these
 * `@context` URLs canonicalizes/verifies out of the box without each caller
 * having to register or allowlist it.
 *
 * Trade-off: resolving a remote context makes verification depend on the live
 * document at that URL. For fully reproducible, offline verification, bundle the
 * context (`registerContext` / `contextOptions.overrides`) and use
 * `policy: "bundled-only"` instead.
 */
export const DEFAULT_TRUSTED_CONTEXT_PATTERNS: readonly string[] = [
	"https://intersectmbo.github.io/governance-actions/**",
];

/**
 * Build a JSON-LD document loader that obeys the configured policy.
 *
 * Resolution order: explicit `overrides` map → runtime-registered contexts →
 * bundled CIP contexts → policy decision (`bundled-only` rejects, `allowlist`
 * fetches matching URLs, `fetch` allows any URL).
 *
 * Default policy is `"allowlist"` with no patterns, so unbundled URLs error
 * with `MISSING_CONTEXT` rather than silently fetching — this keeps signature
 * verification reproducible.
 *
 * @example
 * // Strictest: only bundled CIP contexts allowed
 * createDocumentLoader({ policy: "bundled-only" });
 *
 * @example
 * // Allow Intersect-hosted v1+ schemas
 * createDocumentLoader({
 *   policy: "allowlist",
 *   allowlist: ["https://intersectmbo.github.io/governance-actions/v*​/​**"],
 * });
 */
export function createDocumentLoader(
	options?: ContextResolutionOptions,
): DocumentLoaderFn {
	const policy: ContextPolicy = options?.policy ?? DEFAULT_POLICY;
	const overrides = options?.overrides ?? {};
	const allowlist = options?.allowlist ?? [];
	const fetchImpl = options?.fetch ?? globalThis.fetch;
	const cache = options?.cache ?? new Map<string, RemoteContextDocument>();

	// The default trusted patterns (official Intersect governance-actions
	// hosts) are always honored under `allowlist`, in addition to any
	// caller-supplied patterns. String globs compile to RegExp once here, not
	// on every loader call. globToRegExp anchors and escapes, so a glob-free
	// string still matches exactly.
	const allowlistMatchers: RegExp[] = [
		...allowlist,
		...DEFAULT_TRUSTED_CONTEXT_PATTERNS,
	].map((pattern) =>
		typeof pattern === "string" ? globToRegExp(pattern) : pattern,
	);

	return async (url: string): Promise<RemoteDocument> => {
		if (Object.prototype.hasOwnProperty.call(overrides, url)) {
			const override = overrides[url];
			if (override === undefined || override === null) {
				throw new ParseError(
					ErrorCode.MISSING_CONTEXT,
					`contextOptions.overrides["${url}"] is ${override === null ? "null" : "undefined"} — overrides must contain a JSON-LD context document.`,
				);
			}
			return wrap(url, override);
		}

		const runtime = runtimeBundles.get(url);
		if (runtime) {
			return wrap(url, runtime);
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
				`JSON-LD @context "${url}" was NOT fetched: it is not bundled or registered, and the "bundled-only" policy never makes network requests. The document was therefore NOT canonicalized and its witness signatures were NOT verified. Register it via registerContext() / contextOptions.overrides, or switch contextOptions.policy to "allowlist" (with a matching pattern) or "fetch" to permit fetching.`,
			);
		}

		if (policy === "allowlist") {
			if (!allowlistMatchers.some((matcher) => matcher.test(url))) {
				throw new ParseError(
					ErrorCode.MISSING_CONTEXT,
					`JSON-LD @context "${url}" was NOT fetched: it is not bundled or registered and does not match contextOptions.allowlist or the default trusted hosts, so the "allowlist" policy refused to fetch it. The document was therefore NOT canonicalized and its witness signatures were NOT verified. Add a pattern to contextOptions.allowlist (string with * or ** globs, or a RegExp), pass the document via contextOptions.overrides, or use contextOptions.policy = "fetch".`,
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
