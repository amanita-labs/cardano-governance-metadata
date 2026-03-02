/**
 * Fetch governance metadata from IPFS, Arweave, or HTTPS.
 *
 * fetchMetadata() resolves URIs to raw bytes, handling
 * different protocols transparently:
 * - ipfs://  -> rewrites to an IPFS gateway URL
 * - ar://    -> rewrites to an Arweave gateway URL
 * - https:// -> used directly
 *
 * Returns raw Uint8Array bytes so you can hash them
 * for anchor verification before parsing.
 */
import { fetchMetadata, cip100 } from "cardano-governance-metadata";

// Fetch from IPFS (uses ipfs.io gateway by default)
const ipfsResult = await fetchMetadata(
  "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
);

if (ipfsResult.success) {
  const text = new TextDecoder().decode(ipfsResult.data);
  console.log("Fetched from IPFS:", text.length, "bytes");

  const parsed = cip100.parse(text);
  if (parsed.success) {
    console.log("Parsed successfully");
  }
}

// Fetch from Arweave
const arResult = await fetchMetadata("ar://some-transaction-id");

// Fetch from HTTPS
const httpsResult = await fetchMetadata(
  "https://raw.githubusercontent.com/example/metadata.jsonld",
);

// Custom IPFS gateway (e.g. Pinata, Infura, self-hosted)
const pinataResult = await fetchMetadata(
  "ipfs://QmXyz...",
  { ipfsGateway: "https://gateway.pinata.cloud/ipfs/{cid}" },
);

// Custom Arweave gateway
const customArResult = await fetchMetadata(
  "ar://some-tx-id",
  { arweaveGateway: "https://arweave.example.com" },
);

// Custom timeout and abort signal
const controller = new AbortController();
const timeoutResult = await fetchMetadata(
  "ipfs://QmSlowCid",
  {
    timeout: 10_000,       // 10 seconds (default is 30s)
    signal: controller.signal,
  },
);

// Inject a custom fetch implementation (useful for testing or proxies)
const mockFetch: typeof globalThis.fetch = async (input, init) => {
  console.log("Custom fetch called with:", input);
  return globalThis.fetch(input, init);
};

const customFetchResult = await fetchMetadata(
  "https://example.com/metadata.jsonld",
  { fetch: mockFetch },
);

// Error handling
const badResult = await fetchMetadata("ftp://unsupported.example.com/file");
if (!badResult.success) {
  console.error("Error code:", badResult.error.code);
  // => "UNSUPPORTED_PROTOCOL"
  console.error("Message:", badResult.error.message);
  // => "Unsupported URI scheme: ftp://unsupported.example.com/file"
}
