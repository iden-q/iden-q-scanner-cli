import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

// End-to-end: spawns the actual built CLI (dist/index.js) as a subprocess.
// Requires `yarn build` to have run first; skip gracefully rather than fail
// when dist/ isn't there (e.g. running tests without a prior build step).
const distIndex = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.js");

const RSA_PRIVATE_KEY_PEM =
  "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----";

function runCli(args: string[], input?: string) {
  return spawnSync(process.execPath, [distIndex, ...args], {
    input,
    encoding: "utf8",
  });
}

test("scan --stdin reports a critical RSA finding and a summary line", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /critical/);
  assert.match(result.stdout, /RSA/);
  assert.match(result.stdout, /PEM: RSA PRIVATE KEY/);
  assert.match(result.stdout, /Summary/);
  assert.match(result.stdout, /1 critical/);
});

test("scan --stdin --fail-on critical exits 1 when a critical finding is present", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--fail-on", "critical"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 1);
});

test("scan --stdin --fail-on critical exits 0 when input has no findings", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--fail-on", "critical"], "hello world, nothing interesting here");

  assert.equal(result.status, 0);
});

test("scan --stdin --format json emits a parseable report with the expected shape", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--format", "json"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.criticalCount, 1);
  assert.equal(report.files[0].fileName, "stdin");
  assert.equal(report.files[0].findings[0].algorithm, "RSA");
  assert.equal(report.files[0].findings[0].severity, "critical");
});

test("--help prints usage and exits 0", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /scan-domain/);
});

test("running with no command prints usage and exits 1", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli([]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Usage:/);
});
