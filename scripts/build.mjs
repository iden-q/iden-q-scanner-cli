import { build } from "esbuild";

// q-scanner-lib is a real dependency (installed via node_modules, workspace
// or npm) — external, not bundled in, same as any other npm dependency.
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "node",
  outdir: "dist",
  packages: "external",
  logLevel: "info",
});
