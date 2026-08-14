import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

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

// Every scan/scan-domain run now writes a report file to cwd by default, so
// each test gets a scratch cwd — keeps those artifacts out of the repo and
// isolated between tests instead of piling up in the process's real cwd.
let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "q-scanner-cli-test-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function runCli(args: string[], input?: string) {
  return spawnSync(process.execPath, [distIndex, ...args], {
    input,
    encoding: "utf8",
    cwd,
    // Point the session store at the scratch cwd so auth commands never read or
    // write the real user's ~/.config/q-scanner — each test is isolated.
    env: { ...process.env, XDG_CONFIG_HOME: cwd },
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

test("scan --stdin --format cbom prints the idenq.io footer to stderr, not stdout", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--format", "cbom"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  assert.doesNotThrow(() => JSON.parse(result.stdout), "stdout must stay pure JSON");
  assert.match(result.stderr, /Summary/);
  assert.match(result.stderr, /idenq\.io/);
});

test("scan --stdin writes the report to ./q-scanner-report.txt by default", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  const written = readFileSync(join(cwd, "q-scanner-report.txt"), "utf8");
  assert.match(written, /RSA/);
  assert.match(result.stderr, /Report written to q-scanner-report\.txt/);
});

test("scan --stdin --format cbom writes a CBOM to ./q-scanner-report.cbom.json by default, with no footer text", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--format", "cbom"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  const written = readFileSync(join(cwd, "q-scanner-report.cbom.json"), "utf8");
  const cbom = JSON.parse(written);
  assert.equal(cbom.bomFormat, "CycloneDX");
});

test("scan --stdin --output <path> writes the report to the given path instead of the default", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["scan", "--stdin", "--format", "json", "--output", "custom-report.json"], RSA_PRIVATE_KEY_PEM);

  assert.equal(result.status, 0);
  assert.equal(existsSync(join(cwd, "q-scanner-report.json")), false);
  const written = JSON.parse(readFileSync(join(cwd, "custom-report.json"), "utf8"));
  assert.equal(written.summary.criticalCount, 1);
});

test("--help prints usage and exits 0", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /scan-domain/);
});

test("--help lists the auth commands and the --save option", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["--help"]);

  assert.equal(result.status, 0);
  for (const command of ["login", "logout", "whoami", "history"]) {
    assert.match(result.stdout, new RegExp(`q-scanner ${command}`), `--help should list ${command}`);
  }
  assert.match(result.stdout, /--save/);
});

test("whoami with no session says so and exits 1", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["whoami"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Not logged in/);
});

test("logout with no session is not an error", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["logout"]);

  assert.equal(result.status, 0);
  assert.match(result.stderr, /were not logged in/);
});

test("history with no session says to log in and exits 1", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli(["history"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Not logged in/);
});

test("running with no command prints usage and exits 1", (t) => {
  if (!existsSync(distIndex)) return t.skip("dist/index.js not built — run yarn build first");

  const result = runCli([]);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Usage:/);
});
