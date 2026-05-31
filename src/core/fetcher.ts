import { ErrorCode, FetchError } from "./errors.js";
import type { FetchOptions, Result } from "./types.js";

const DEFAULT_IPFS_GATEWAY = "https://ipfs.io/ipfs/{cid}";
const DEFAULT_ARWEAVE_GATEWAY = "https://arweave.net";
const DEFAULT_TIMEOUT = 30_000;

function resolveUri(uri: string, options?: FetchOptions): string {
	if (uri.startsWith("ipfs://")) {
		const cid = uri.slice("ipfs://".length);
		const gateway = options?.ipfsGateway ?? DEFAULT_IPFS_GATEWAY;
		return gateway.replace("{cid}", cid);
	}

	if (uri.startsWith("ar://")) {
		const txId = uri.slice("ar://".length);
		const gateway = options?.arweaveGateway ?? DEFAULT_ARWEAVE_GATEWAY;
		return `${gateway}/${txId}`;
	}

	if (uri.startsWith("https://") || uri.startsWith("http://")) {
		return uri;
	}

	throw new FetchError(
		ErrorCode.UNSUPPORTED_PROTOCOL,
		`Unsupported URI scheme: ${uri}`,
	);
}

/**
 * Fetch raw bytes from a metadata URI.
 *
 * Supported schemes:
 * - `https://` / `http://` — used directly,
 * - `ipfs://<cid>` — rewritten to the configured (or default `ipfs.io`) gateway,
 * - `ar://<txId>` — rewritten to the configured (or default `arweave.net`) gateway.
 *
 * Returns raw bytes (`Uint8Array`) so callers can compute the on-chain anchor
 * hash before parsing JSON. Default timeout is 30s.
 *
 * @example
 * const r = await fetchMetadata("ipfs://QmExampleCid", {
 *   ipfsGateway: "https://gateway.pinata.cloud/ipfs/{cid}",
 *   timeout: 10_000,
 * });
 * if (r.success) parseDocument(r.data);
 */
export async function fetchMetadata(
	uri: string,
	options?: FetchOptions,
): Promise<Result<Uint8Array, FetchError>> {
	let timedOut = false;
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let externalSignal: AbortSignal | undefined;
	let externalListener: (() => void) | undefined;
	let controller: AbortController | undefined;

	try {
		const url = resolveUri(uri, options);
		const fetchFn = options?.fetch ?? globalThis.fetch;
		const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

		controller = new AbortController();
		timeoutId = setTimeout(() => {
			timedOut = true;
			controller?.abort();
		}, timeout);

		externalSignal = options?.signal;
		if (externalSignal) {
			if (externalSignal.aborted) {
				controller.abort();
			} else {
				externalListener = () => controller?.abort();
				externalSignal.addEventListener("abort", externalListener, {
					once: true,
				});
			}
		}

		const response = await fetchFn(url, { signal: controller.signal });

		if (!response.ok) {
			return {
				success: false,
				error: new FetchError(
					ErrorCode.FETCH_FAILED,
					`HTTP ${response.status}: ${response.statusText}`,
				),
			};
		}

		const buffer = await response.arrayBuffer();
		return { success: true, data: new Uint8Array(buffer) };
	} catch (err) {
		if (err instanceof FetchError) {
			return { success: false, error: err };
		}

		const isAbort =
			(err instanceof DOMException && err.name === "AbortError") ||
			(err instanceof Error && err.name === "AbortError");

		if (isAbort) {
			if (timedOut) {
				return {
					success: false,
					error: new FetchError(
						ErrorCode.FETCH_TIMEOUT,
						"Request timed out",
						err,
					),
				};
			}
			return {
				success: false,
				error: new FetchError(
					ErrorCode.FETCH_ABORTED,
					"Request aborted by caller",
					err,
				),
			};
		}

		return {
			success: false,
			error: new FetchError(
				ErrorCode.FETCH_FAILED,
				`Fetch failed: ${err}`,
				err,
			),
		};
	} finally {
		if (timeoutId !== undefined) clearTimeout(timeoutId);
		if (externalSignal && externalListener) {
			externalSignal.removeEventListener("abort", externalListener);
		}
	}
}
