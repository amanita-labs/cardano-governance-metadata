import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// The library is consumed via a `file:..` dependency that resolves to the
// repo's built `dist/`. The CSL browser package is WASM-backed, which is why
// it is excluded from esbuild dep pre-bundling and handled by vite-plugin-wasm.
export default defineConfig({
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    // Allow Vite to read fixture files that live outside `demo/` (in
    // ../docs/examples/fixtures) so they can be imported with `?raw`.
    fs: { allow: [".."] },
  },
  optimizeDeps: {
    exclude: ["@emurgo/cardano-serialization-lib-browser"],
  },
  build: {
    // WASM ESM integration + top-level await require a modern target.
    target: "esnext",
  },
});
