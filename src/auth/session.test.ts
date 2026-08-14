import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireSession, NotLoggedInError } from "./session.js";
import { writeSession, readSession } from "./session-store.js";

let dir: string;
let env: NodeJS.ProcessEnv;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "q-scanner-session-hl-"));
  env = { XDG_CONFIG_HOME: dir };
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
});

function jwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

const NOW = 1_000_000;

test("no stored session throws NotLoggedInError", async () => {
  await assert.rejects(requireSession(env, NOW), NotLoggedInError);
});

test("a live access token is returned without a refresh call", async () => {
  globalThis.fetch = (() => {
    throw new Error("must not refresh a live token");
  }) as typeof fetch;
  await writeSession(
    { apiUrl: "https://dev.idenq.io/api/v1", accessToken: jwt({ sub: "u1", roles: ["scanner:user"], exp: NOW + 600 }), refreshToken: "r1", obtainedAt: 0 },
    env,
  );
  const session = await requireSession(env, NOW);
  assert.equal(session.claims?.sub, "u1");
  assert.deepEqual(session.claims?.roles, ["scanner:user"]);
});

test("an expired access token is refreshed, and the rotated pair is persisted", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ accessToken: jwt({ sub: "u1", roles: ["scanner:user"], exp: NOW + 600 }), refreshToken: "r2" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  await writeSession(
    { apiUrl: "https://dev.idenq.io/api/v1", accessToken: jwt({ sub: "u1", exp: NOW - 10 }), refreshToken: "r1", obtainedAt: 0 },
    env,
  );

  const session = await requireSession(env, NOW);
  assert.deepEqual(session.claims?.roles, ["scanner:user"]);
  // The rotated refresh token is written back so the next refresh does not replay r1.
  assert.equal((await readSession(env))?.refreshToken, "r2");
});

test("a spent refresh token surfaces as NotLoggedInError, not a raw 401", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } })) as typeof fetch;
  await writeSession(
    { apiUrl: "https://dev.idenq.io/api/v1", accessToken: jwt({ sub: "u1", exp: NOW - 10 }), refreshToken: "spent", obtainedAt: 0 },
    env,
  );
  await assert.rejects(requireSession(env, NOW), NotLoggedInError);
});
