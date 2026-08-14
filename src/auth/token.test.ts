import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeToken, isExpired } from "./token.js";

/** Build a JWT-shaped string with the given payload (unsigned — the CLI never
 * verifies, so the signature segment is a placeholder). */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

test("decodeToken reads sub, email, roles, exp and acr from the payload", () => {
  const claims = decodeToken(jwt({ sub: "auth-1", email: "dev@idenq.io", roles: ["platform:user", "scanner:user"], exp: 123, acr: "aal2" }));
  assert.deepEqual(claims, { sub: "auth-1", email: "dev@idenq.io", roles: ["platform:user", "scanner:user"], exp: 123, acr: "aal2" });
});

test("decodeToken defaults roles to [] and non-string roles are dropped", () => {
  const claims = decodeToken(jwt({ sub: "x", roles: ["a", 5, null, "b"] }));
  assert.deepEqual(claims?.roles, ["a", "b"]);
  assert.deepEqual(decodeToken(jwt({ sub: "x" }))?.roles, []);
});

test("decodeToken returns null for anything that is not a JWT", () => {
  assert.equal(decodeToken("not-a-jwt"), null);
  assert.equal(decodeToken(""), null);
  // A payload segment that is not base64url JSON decodes to nothing parseable.
  assert.equal(decodeToken("a.!!!.c"), null);
});

test("isExpired is false well before exp and true after (with skew)", () => {
  const now = 1_000_000;
  assert.equal(isExpired(jwt({ exp: now + 600 }), now), false);
  assert.equal(isExpired(jwt({ exp: now - 1 }), now), true);
  // Within the default 30s skew it is already considered expired, so a call
  // refreshes just before the token actually dies.
  assert.equal(isExpired(jwt({ exp: now + 20 }), now), true);
});

test("a token with no readable exp is treated as expired (refresh rather than send a doomed token)", () => {
  assert.equal(isExpired(jwt({ sub: "x" }), 1_000_000), true);
  assert.equal(isExpired("garbage", 1_000_000), true);
});
