import { describe, expect, test } from "bun:test";
import {
  clearRegisteredContexts,
  createDocumentLoader,
  registerContext,
} from "../context.js";

describe("createDocumentLoader policy", () => {
  test("bundled CIP-100 URL resolves offline", async () => {
    const loader = createDocumentLoader({ policy: "bundled-only" });
    const doc = await loader(
      "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld",
    );
    expect(doc.documentUrl).toContain("cip-0100");
    expect(doc.document).toBeTruthy();
  });

  test("bundled CIP-169 URL resolves offline (both raw + blob variants)", async () => {
    const loader = createDocumentLoader({ policy: "bundled-only" });
    const raw = await loader(
      "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0169/cip-0169.common.jsonld",
    );
    const blob = await loader(
      "https://github.com/cardano-foundation/CIPs/blob/master/CIP-0169/cip-0169.common.jsonld",
    );
    expect(raw.document).toEqual(blob.document);
  });

  test("bundled-only rejects unknown URLs", async () => {
    const loader = createDocumentLoader({ policy: "bundled-only" });
    await expect(loader("https://example.com/ctx.jsonld")).rejects.toThrow(
      /not bundled/i,
    );
  });

  test("allowlist with no patterns rejects unknown URLs", async () => {
    const loader = createDocumentLoader({ policy: "allowlist", allowlist: [] });
    await expect(
      loader("https://intersectmbo.github.io/governance-actions/v1.1.0/x"),
    ).rejects.toThrow(/does not match/i);
  });

  test("allowlist with glob fetches matching URL", async () => {
    const fetched: string[] = [];
    const loader = createDocumentLoader({
      policy: "allowlist",
      allowlist: ["https://intersectmbo.github.io/governance-actions/v*/**"],
      fetch: (async (url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url.toString();
        fetched.push(u);
        return new Response(JSON.stringify({ "@context": { x: "y" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch,
    });
    const doc = await loader(
      "https://intersectmbo.github.io/governance-actions/v1.1.0/schemas/x/common.jsonld",
    );
    expect(fetched).toHaveLength(1);
    expect(doc.document).toEqual({ "@context": { x: "y" } });
  });

  test("overrides beat both bundled and allowlist", async () => {
    const loader = createDocumentLoader({
      policy: "bundled-only",
      overrides: {
        "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld":
          { "@context": { sentinel: "override" } },
      },
    });
    const doc = await loader(
      "https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0100/cip-0100.common.jsonld",
    );
    expect((doc.document as { "@context": { sentinel: string } })["@context"].sentinel).toBe("override");
  });

  test("registerContext exposes a runtime URL to the loader", async () => {
    clearRegisteredContexts();
    registerContext("https://example.com/custom.jsonld", {
      "@context": { hello: "world" },
    });
    const loader = createDocumentLoader({ policy: "bundled-only" });
    const doc = await loader("https://example.com/custom.jsonld");
    expect(doc.document).toEqual({ "@context": { hello: "world" } });
    clearRegisteredContexts();
  });
});
