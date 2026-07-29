import { execSync } from "node:child_process";
import { readdirSync, unlinkSync } from "node:fs";

// Guards the one requirement that matters most here: the obfuscated dist/ is
// what ships, dist-maps/ never does. "files" in package.json already excludes
// dist-maps/, but this checks the actual tarball about to be published, not
// just the config, in case that field ever drifts. Runs as prepublishOnly, so
// it's enforced on every publish path (changesets, plain `npm publish`, CI).
execSync("npm pack", { stdio: "inherit" });

const tarball = readdirSync(".").find((f) => f.endsWith(".tgz"));
const contents = execSync(`tar -tzf ${tarball}`).toString();
const leaked = contents.split("\n").filter((line) => line.endsWith(".map"));

if (leaked.length > 0) {
  console.error("sourcemap (.map) file present in npm tarball — aborting publish");
  console.error(leaked.join("\n"));
  process.exit(1);
}

unlinkSync(tarball);
console.log("tarball verified clean — no sourcemaps");
