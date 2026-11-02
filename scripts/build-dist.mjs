import { rm } from "node:fs/promises";
import { build } from "esbuild";

// Output is CommonJS: several transitive deps (tunnel, undici) are still CJS
// and call `require()` on Node builtins, which breaks inside an ESM bundle.
// `.cjs` is required because package.json sets "type": "module".
await rm("dist/setup-air/index.js", { force: true });

await build({
  bundle: true,
  entryPoints: ["src/setup-air.ts"],
  format: "cjs",
  outfile: "dist/setup-air/index.cjs",
  platform: "node",
  target: "node24",
});
