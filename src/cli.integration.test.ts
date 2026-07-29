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

// A real BIP39-shaped seed phrase, alone on its own line — the wallet
// scanner's location label for this is locale-dependent (unlike the PEM
// header labels above, which are the standard's own English text and never
// translated), so it's the fixture used to check --lang end-to-end.
const SEED_PHRASE = "abandon ability able about above absent absorb abstract absurd abuse access accident";

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

test("scan --stdin defaults to English location text for a wallet finding", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin"], SEED_PHRASE);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Possible seed phrase \(BIP39\)/);
});

test("scan --stdin --lang es localizes wallet finding location text to Spanish", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--lang", "es"], SEED_PHRASE);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Posible frase semilla \(BIP39\)/);
});

test("scan --stdin --lang fr rejects an unsupported language", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--lang", "fr"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--lang must be one of/);
});

test("scan --stdin --format cbom emits a CycloneDX CBOM tagging RSA with its FIPS 203 migration target", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--format", "cbom"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  const cbom = JSON.parse(result.stdout);
  assert.equal(cbom.bomFormat, "CycloneDX");
  const rsa = cbom.components.find((c: { name: string }) => c.name === "RSA");
  assert.ok(rsa, "expected an RSA component in the CBOM");
  assert.equal(rsa.cryptoProperties.algorithmProperties.nistQuantumSafe, false);
  assert.match(rsa.migrationTarget, /FIPS 203/);
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
