import jsonld from "jsonld";
import {
	type DocumentLoader,
	type DocumentLoaderFn,
	createDocumentLoader,
} from "./context.js";
import {
	ErrorCode,
	GovernanceMetadataError,
	VerificationError,
} from "./errors.js";
import type { ContextResolutionOptions, Result } from "./types.js";

export interface CanonicalizeOptions {
	documentLoader?: DocumentLoader | DocumentLoaderFn;
	contextOptions?: ContextResolutionOptions;
}

/**
 * jsonld safe-mode warnings that indicate the value is preserved in the
 * canonical form (just as a relative IRI rather than absolute). These are
 * NOT data loss and are safe to allow — a witness signature still binds
 * the value.
 *
 * The published CIP-100/108/119/136 `@context` documents do not define
 * `@vocab` and do not declare every `@type` value as a term (`"Other"`,
 * `"Link"`, `"Identity"`, …), so canonicalization unavoidably emits these.
 * The dangerous codes (`invalid property`, `free-floating scalar`, etc.)
 * are NOT in this set and still cause CANONICALIZATION_FAILED.
 */
const NON_DATA_LOSS_EVENT_CODES = new Set<string>([
	"relative @type reference",
	"relative @id reference",
	"relative @vocab reference",
	"relative object reference",
	"relative predicate reference",
	"relative subject reference",
	"relative graph reference",
]);

/**
 * Canonicalize a JSON-LD document to N-Quads using the URDNA2015 algorithm.
 *
 * For CIP-100 witness verification, callers typically pass the body envelope
 * `{ "@context": doc["@context"], body: doc.body }` rather than the full
 * document — the witness signs only the canonicalized body (not authors or
 * other envelope fields).
 *
 * Runs in strict mode for data-loss events: any body field not mapped by the
 * `@context` causes canonicalization to fail with `CANONICALIZATION_FAILED`.
 * This prevents signature-confusion attacks where an attacker appends an
 * unmapped field that jsonld would have dropped from the canonical form (so
 * the signature still verifies) but that a consumer of the parsed document
 * might still read and trust. Schemas still permit extra fields via
 * `.passthrough()`, so the field is visible to `resolve()`'s `extraFields`
 * reporter — but verification will refuse it.
 *
 * Cosmetic warnings that do NOT drop data (e.g. `relative @type reference`,
 * which preserves the value as a relative IRI in the canonical N-Quads) are
 * accepted. This is necessary because the published CIP-100/108/119/136
 * `@context` documents do not declare every `@type` value (`"Other"`,
 * `"Link"`, etc.) as a term.
 *
 * @returns `Result<string, VerificationError>` — the N-Quads (always ending
 *          with `\n` if non-empty), or a `CANONICALIZATION_FAILED` error.
 */
export async function canonicalizeBody(
	document: Record<string, unknown>,
	options?: CanonicalizeOptions,
): Promise<Result<string, VerificationError>> {
	try {
		const documentLoader =
			options?.documentLoader ?? createDocumentLoader(options?.contextOptions);

		// Canonicalize the full document to N-Quads using URDNA2015. We
		// disable jsonld's built-in safe handler (`safe: false`) and provide
		// our own that throws on data-loss warnings only — see
		// NON_DATA_LOSS_EVENT_CODES above for the allow-list.
		const canonicalized = await jsonld.canonize(document, {
			algorithm: "URDNA2015",
			format: "application/n-quads",
			documentLoader,
			// `safe`/`eventHandler` are jsonld 8.x runtime API, not yet in
			// @types/jsonld 1.5.x.
			safe: false,
			eventHandler: ({
				event,
				next,
			}: {
				event: { code: string; level: string; message: string };
				next: () => void;
			}) => {
				if (
					event.level === "warning" &&
					!NON_DATA_LOSS_EVENT_CODES.has(event.code)
				) {
					throw new VerificationError(
						ErrorCode.CANONICALIZATION_FAILED,
						`JSON-LD canonicalization rejected by safe mode: ${event.code} — ${event.message}. Body fields that are not mapped by the @context are silently dropped from the canonical form and therefore NOT covered by the witness signature.`,
					);
				}
				next();
			},
		} as Parameters<typeof jsonld.canonize>[1]);

		// Ensure it ends with a newline
		const nquads =
			typeof canonicalized === "string" ? canonicalized : String(canonicalized);

		const result =
			nquads.endsWith("\n") || nquads === "" ? nquads : `${nquads}\n`;

		return { success: true, data: result };
	} catch (err) {
		// jsonld's ContextResolver re-wraps ANY documentLoader error as a generic
		// `jsonld.InvalidUrl` "Dereferencing a URL did not result in a valid
		// JSON-LD object… same-origin policy… too many redirects…" message,
		// stashing the original error under `details.cause`. That generic text is
		// actively misleading when the real cause is, e.g., a `MISSING_CONTEXT`
		// from our own loader (the URL is perfectly reachable). Surface the real
		// underlying error instead — see `unwrapLoaderError`.
		const real = unwrapLoaderError(err);
		return {
			success: false,
			error: new VerificationError(
				ErrorCode.CANONICALIZATION_FAILED,
				`Failed to canonicalize document: ${real ? `${real.code}: ${real.message}` : err}`,
				real ?? err,
			),
		};
	}
}

/**
 * Walk an error's cause chain (jsonld stashes the original under
 * `details.cause`; native errors use `cause`) and return the first
 * `GovernanceMetadataError` found — i.e. the real reason a context failed to
 * load, before jsonld masked it with its generic dereferencing message.
 */
function unwrapLoaderError(err: unknown): GovernanceMetadataError | undefined {
	const seen = new Set<unknown>();
	let current: unknown = err;
	while (current && typeof current === "object" && !seen.has(current)) {
		seen.add(current);
		if (current instanceof GovernanceMetadataError) return current;
		const next =
			(current as { details?: { cause?: unknown } }).details?.cause ??
			(current as { cause?: unknown }).cause;
		current = next;
	}
	return undefined;
}
