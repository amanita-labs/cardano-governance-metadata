import { describe, expect, test } from "bun:test";
import { ErrorCode } from "../errors.js";
import { fetchMetadata } from "../fetcher.js";

function fetchWith(
	handler: (url: string) => Promise<Response> | Response,
): typeof fetch {
	return (async (url: string | URL | Request) => {
		const u = typeof url === "string" ? url : url.toString();
		return handler(u);
	}) as unknown as typeof fetch;
}

function okResponse(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

describe("fetchMetadata", () => {
	test("https:// happy path returns bytes", async () => {
		const r = await fetchMetadata("https://example.com/meta.jsonld", {
			fetch: fetchWith(() => okResponse('{"hello":"world"}')),
		});
		expect(r.success).toBe(true);
		if (!r.success) return;
		expect(new TextDecoder().decode(r.data)).toBe('{"hello":"world"}');
	});

	test("http:// also works", async () => {
		const r = await fetchMetadata("http://example.com/meta.jsonld", {
			fetch: fetchWith(() => okResponse("{}")),
		});
		expect(r.success).toBe(true);
	});

	test("ipfs:// is rewritten to the default ipfs.io gateway", async () => {
		let captured = "";
		const r = await fetchMetadata("ipfs://bafyExample123", {
			fetch: fetchWith((url) => {
				captured = url;
				return okResponse("{}");
			}),
		});
		expect(r.success).toBe(true);
		expect(captured).toBe("https://ipfs.io/ipfs/bafyExample123");
	});

	test("ipfs:// uses a custom gateway when supplied", async () => {
		let captured = "";
		const r = await fetchMetadata("ipfs://bafyExample123", {
			ipfsGateway: "https://my-gateway.example/{cid}",
			fetch: fetchWith((url) => {
				captured = url;
				return okResponse("{}");
			}),
		});
		expect(r.success).toBe(true);
		expect(captured).toBe("https://my-gateway.example/bafyExample123");
	});

	test("ar:// is rewritten to the default arweave gateway", async () => {
		let captured = "";
		const r = await fetchMetadata("ar://abc123", {
			fetch: fetchWith((url) => {
				captured = url;
				return okResponse("{}");
			}),
		});
		expect(r.success).toBe(true);
		expect(captured).toBe("https://arweave.net/abc123");
	});

	test("ar:// uses a custom gateway when supplied", async () => {
		let captured = "";
		const r = await fetchMetadata("ar://abc123", {
			arweaveGateway: "https://my-arweave.example",
			fetch: fetchWith((url) => {
				captured = url;
				return okResponse("{}");
			}),
		});
		expect(r.success).toBe(true);
		expect(captured).toBe("https://my-arweave.example/abc123");
	});

	test("unsupported scheme returns FetchError with UNSUPPORTED_PROTOCOL", async () => {
		const r = await fetchMetadata("ftp://example.com/file");
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.UNSUPPORTED_PROTOCOL);
	});

	test("non-2xx response returns FetchError with FETCH_FAILED", async () => {
		const r = await fetchMetadata("https://example.com/missing", {
			fetch: fetchWith(
				() =>
					new Response("not found", { status: 404, statusText: "Not Found" }),
			),
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.FETCH_FAILED);
		expect(r.error.message).toContain("404");
	});

	test("AbortSignal timeout produces FETCH_TIMEOUT", async () => {
		const r = await fetchMetadata("https://example.com/slow", {
			timeout: 10,
			fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, 1000);
					init?.signal?.addEventListener("abort", () => {
						clearTimeout(timer);
						reject(
							new DOMException("aborted", "AbortError") as unknown as Error,
						);
					});
				});
				return new Response("late");
			}) as unknown as typeof fetch,
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.FETCH_TIMEOUT);
	});

	test("external AbortSignal cancellation produces FETCH_ABORTED (distinct from timeout)", async () => {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5);
		const r = await fetchMetadata("https://example.com/slow", {
			signal: controller.signal,
			fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, 1000);
					init?.signal?.addEventListener("abort", () => {
						clearTimeout(timer);
						reject(
							new DOMException("aborted", "AbortError") as unknown as Error,
						);
					});
				});
				return new Response("late");
			}) as unknown as typeof fetch,
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.FETCH_ABORTED);
	});

	test("pre-aborted external signal short-circuits (does not wait for timeout)", async () => {
		const controller = new AbortController();
		controller.abort();
		const start = Date.now();
		const r = await fetchMetadata("https://example.com/slow", {
			signal: controller.signal,
			timeout: 30_000,
			fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
				// Spec-compliant fetch implementations reject synchronously when
				// given an already-aborted signal. Mock that here.
				if (init?.signal?.aborted) {
					throw new DOMException("aborted", "AbortError") as unknown as Error;
				}
				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(resolve, 30_000);
					init?.signal?.addEventListener("abort", () => {
						clearTimeout(timer);
						reject(
							new DOMException("aborted", "AbortError") as unknown as Error,
						);
					});
				});
				return new Response("late");
			}) as unknown as typeof fetch,
		});
		const elapsed = Date.now() - start;
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.FETCH_ABORTED);
		expect(elapsed).toBeLessThan(1000);
	});

	test("external signal listener is removed after the call (no leak across reuse)", async () => {
		const controller = new AbortController();
		let listenerCount = 0;
		const origAdd = controller.signal.addEventListener.bind(controller.signal);
		const origRemove = controller.signal.removeEventListener.bind(
			controller.signal,
		);
		controller.signal.addEventListener = ((
			type: string,
			handler: EventListenerOrEventListenerObject,
			opts?: AddEventListenerOptions | boolean,
		) => {
			if (type === "abort") listenerCount++;
			return origAdd(type, handler, opts);
		}) as typeof controller.signal.addEventListener;
		controller.signal.removeEventListener = ((
			type: string,
			handler: EventListenerOrEventListenerObject,
			opts?: EventListenerOptions | boolean,
		) => {
			if (type === "abort") listenerCount--;
			return origRemove(type, handler, opts);
		}) as typeof controller.signal.removeEventListener;

		for (let i = 0; i < 5; i++) {
			await fetchMetadata("https://example.com/x", {
				signal: controller.signal,
				fetch: fetchWith(() => okResponse("{}")),
			});
		}
		expect(listenerCount).toBe(0);
	});

	test("synchronous fetch throw becomes a FetchError result (no rejection)", async () => {
		const r = await fetchMetadata("https://example.com/x", {
			fetch: (() => {
				throw new TypeError("network down");
			}) as unknown as typeof fetch,
		});
		expect(r.success).toBe(false);
		if (r.success) return;
		expect(r.error.code).toBe(ErrorCode.FETCH_FAILED);
	});
});
