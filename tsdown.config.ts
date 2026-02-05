import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "lib",
  platform: "node",
  external: ["@types/estree", "@types/json-schema", "@eslint/core", "eslint"],
});
