import type { FetchOptions, Result } from "./types.js";
import { ErrorCode, FetchError } from "./errors.js";

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

  throw new FetchError(ErrorCode.UNSUPPORTED_PROTOCOL, `Unsupported URI scheme: ${uri}`);
}

export async function fetchMetadata(
  uri: string,
  options?: FetchOptions,
): Promise<Result<Uint8Array, FetchError>> {
  try {
    const url = resolveUri(uri, options);
    const fetchFn = options?.fetch ?? globalThis.fetch;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    try {
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
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    if (err instanceof FetchError) {
      return { success: false, error: err };
    }

    const isAbort =
      err instanceof DOMException && err.name === "AbortError";

    return {
      success: false,
      error: new FetchError(
        isAbort ? ErrorCode.FETCH_TIMEOUT : ErrorCode.FETCH_FAILED,
        isAbort ? "Request timed out" : `Fetch failed: ${err}`,
        err,
      ),
    };
  }
}
