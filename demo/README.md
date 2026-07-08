# Governance Metadata · Instrument (demo)

An interactive, offline-first browser playground for
[`@amanita-labs/cardano-governance-metadata`](../). It exercises the library's
full public API: validating existing metadata and generating new metadata
across **CIP-100 / 108 / 119 / 136**, plus the **CIP-169** on-chain binding
extension (decode a Conway transaction and verify metadata against it).

## What it shows

| Tab | Library APIs |
| --- | --- |
| **Validate** | `detectCipStandard`, `cipNNN.validate`, `cipNNN.verify` (anchor hash + ed25519 / CIP-8 witnesses), `resolve` (URI → full pipeline + extra fields) |
| **Generate** | `cipNNN.build`, `cip169.build`, `cip169.actions.*`, round-trip via `parse` |
| **On-Chain · CIP-169** | `compareOnChain`, `decodeConwayTx`, `verifyAgainstTx`, `setCardanoSerializationLib` |
| **Toolbox** | `decodeCoseSign1`, `listBundledContextUrls`, `registerContext`, `clearRegisteredContexts` |

Everything runs in the browser. The only feature that touches the network is the
optional `resolve()`-from-URI affordance on the Validate tab.

## Run it

The demo depends on the library via `file:..`, which resolves to the built
`dist/`. **Build the library first**, from the repo root:

```bash
# from the repository root
bun run build      # or: npm run build
```

Then start the demo:

```bash
cd demo
npm install        # resolves file:.. + the CSL browser WASM build
npm run dev        # open the printed localhost URL
```

Production build / preview:

```bash
npm run build && npm run preview
```

## Notes

- **CIP-169 / CSL:** the Cardano Serialization Library browser build (WASM, a
  few MB) is loaded lazily the first time you use *Verify against tx*. Vite is
  configured for this via `vite-plugin-wasm` + `vite-plugin-top-level-await`.
- **Offline canonicalization:** signature verification canonicalizes the
  document body with the `bundled-only` context policy, so the bundled CIP
  contexts resolve with no network.
- **Samples** are real fixtures from the library's test corpus
  (`../docs/examples/fixtures/`), imported as raw strings.
