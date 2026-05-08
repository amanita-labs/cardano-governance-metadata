import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve as nodeResolve } from "node:path";
import { detectCipStandard, resolve } from "../index.js";

const FIXTURE_DIR = nodeResolve(
  import.meta.dir,
  "..",
  "..",
  "docs",
  "examples",
  "fixtures",
  "cip-0169",
);

function loadFixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(`${FIXTURE_DIR}/${name}`));
}

function makeFetchFor(bytes: Uint8Array): typeof fetch {
  return (async () =>
    new Response(new Blob([bytes as unknown as BlobPart]), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("resolve + detect on CIP-0169 fixtures", () => {
  test("treasury-withdrawal: detects CIP-108, extensions includes CIP-169", async () => {
    const bytes = loadFixtureBytes("treasury-withdrawal.jsonld");
    const r = await resolve("https://fixture/treasury-withdrawal.jsonld", {
      skipVerification: true,
      fetchOptions: { fetch: makeFetchFor(bytes) },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.cipStandard).toBe("CIP-108");
    expect(r.data.extensions).toContain("CIP-169");
    expect(r.data.extraFields).toEqual([]);
  });

  test("parameter-change: detects CIP-108, extensions includes CIP-169", async () => {
    const bytes = loadFixtureBytes("parameter-change.jsonld");
    const r = await resolve("https://fixture/parameter-change.jsonld", {
      skipVerification: true,
      fetchOptions: { fetch: makeFetchFor(bytes) },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.cipStandard).toBe("CIP-108");
    expect(r.data.extensions).toContain("CIP-169");
  });

  test("vote: detects CIP-100 fallback, extensions still includes CIP-169", async () => {
    const bytes = loadFixtureBytes("vote.jsonld");
    const r = await resolve("https://fixture/vote.jsonld", {
      skipVerification: true,
      fetchOptions: { fetch: makeFetchFor(bytes) },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.cipStandard).toBe("CIP-100");
    expect(r.data.extensions).toContain("CIP-169");
  });

  test("detectCipStandard alone is unchanged: still ignores onChain", () => {
    const doc = JSON.parse(
      new TextDecoder().decode(loadFixtureBytes("treasury-withdrawal.jsonld")),
    );
    expect(detectCipStandard(doc)).toBe("CIP-108");
  });
});
