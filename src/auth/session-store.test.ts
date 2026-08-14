import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSession, writeSession, clearSession, sessionPath, type StoredSession } from "./session-store.js";

let dir: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "q-scanner-session-"));
  env = { XDG_CONFIG_HOME: dir };
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const SAMPLE: StoredSession = {
  apiUrl: "https://dev.idenq.io/api/v1",
  accessToken: "a.b.c",
  refreshToken: "refresh-xyz",
  obtainedAt: 1_700_000_000_000,
};

test("the session lives under XDG_CONFIG_HOME/q-scanner/session.json", () => {
  assert.equal(sessionPath(env), join(dir, "q-scanner", "session.json"));
});

test("write then read round-trips the session", async () => {
  await writeSession(SAMPLE, env);
  assert.deepEqual(await readSession(env), SAMPLE);
});

test("the session file is written 0600 and its directory 0700", async () => {
  await writeSession(SAMPLE, env);
  assert.equal(statSync(sessionPath(env)).mode & 0o777, 0o600);
  assert.equal(statSync(join(dir, "q-scanner")).mode & 0o777, 0o700);
});

test("a re-login tightens the mode back to 0600 even over an existing file", async () => {
  await writeSession(SAMPLE, env);
  await writeSession({ ...SAMPLE, accessToken: "d.e.f" }, env);
  assert.equal(statSync(sessionPath(env)).mode & 0o777, 0o600);
  assert.equal((await readSession(env))?.accessToken, "d.e.f");
});

test("reading with no session file returns null, not an error", async () => {
  assert.equal(await readSession(env), null);
});

test("reading a corrupt or wrong-shaped file returns null (log in again, never crash)", async () => {
  await writeSession(SAMPLE, env);
  // Overwrite with garbage and with a shape missing the tokens.
  const { writeFileSync } = await import("node:fs");
  writeFileSync(sessionPath(env), "not json at all");
  assert.equal(await readSession(env), null);
  writeFileSync(sessionPath(env), JSON.stringify({ apiUrl: "x" }));
  assert.equal(await readSession(env), null);
});

test("clear removes the session, and clearing an absent session is not an error", async () => {
  await writeSession(SAMPLE, env);
  await clearSession(env);
  assert.equal(await readSession(env), null);
  await clearSession(env); // idempotent
});
