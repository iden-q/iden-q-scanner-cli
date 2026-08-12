import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMeshEmit } from "./mesh-emit.js";

const NO_ENV: Record<string, string | undefined> = {};

test("resolveMeshEmit is off when --connect-mesh is absent", () => {
  assert.deepEqual(resolveMeshEmit({}, NO_ENV), { kind: "off" });
  assert.deepEqual(resolveMeshEmit({ connect: false, key: "a:b", url: "https://x" }, NO_ENV), { kind: "off" });
});

test("resolveMeshEmit parses an inline --mesh-key clientId:apiKey", () => {
  const r = resolveMeshEmit({ connect: true, key: "client-1:iden_q_key_abc", url: "https://dev.idenq.io" }, NO_ENV);
  assert.deepEqual(r, {
    kind: "emit",
    config: { clientId: "client-1", apiKey: "iden_q_key_abc", baseUrl: "https://dev.idenq.io" },
  });
});

test("resolveMeshEmit splits the key on the first colon so a secret may contain colons", () => {
  const r = resolveMeshEmit({ connect: true, key: "cid:iden:q:key", url: "https://x" }, NO_ENV);
  assert.equal(r.kind, "emit");
  if (r.kind === "emit") {
    assert.equal(r.config.clientId, "cid");
    assert.equal(r.config.apiKey, "iden:q:key");
  }
});

test("resolveMeshEmit rejects a malformed --mesh-key", () => {
  for (const key of ["nocolon", ":secret", "clientid:"]) {
    assert.deepEqual(resolveMeshEmit({ connect: true, key, url: "https://x" }, NO_ENV), {
      kind: "skip",
      reason: "badKey",
    });
  }
});

test("resolveMeshEmit falls back to env credentials when no inline key is given", () => {
  const env = { IDENQ_MESH_CLIENT_ID: "env-client", IDENQ_MESH_API_KEY: "env-secret", IDENQ_MESH_URL: "https://idenq.io" };
  assert.deepEqual(resolveMeshEmit({ connect: true }, env), {
    kind: "emit",
    config: { clientId: "env-client", apiKey: "env-secret", baseUrl: "https://idenq.io" },
  });
});

test("an inline key takes precedence over env credentials", () => {
  const env = { IDENQ_MESH_CLIENT_ID: "env-client", IDENQ_MESH_API_KEY: "env-secret", IDENQ_MESH_URL: "https://idenq.io" };
  const r = resolveMeshEmit({ connect: true, key: "inline:inlinesecret" }, env);
  assert.equal(r.kind, "emit");
  if (r.kind === "emit") assert.equal(r.config.clientId, "inline");
});

test("--mesh-url takes precedence over IDENQ_MESH_URL", () => {
  const env = { IDENQ_MESH_URL: "https://from-env" };
  const r = resolveMeshEmit({ connect: true, key: "c:s", url: "https://from-flag" }, env);
  assert.equal(r.kind, "emit");
  if (r.kind === "emit") assert.equal(r.config.baseUrl, "https://from-flag");
});

test("resolveMeshEmit skips (missingCredential) when opted in with no key and no env", () => {
  assert.deepEqual(resolveMeshEmit({ connect: true, url: "https://x" }, NO_ENV), {
    kind: "skip",
    reason: "missingCredential",
  });
  // Half a credential is still missing.
  assert.deepEqual(resolveMeshEmit({ connect: true, url: "https://x" }, { IDENQ_MESH_CLIENT_ID: "only-id" }), {
    kind: "skip",
    reason: "missingCredential",
  });
});

test("resolveMeshEmit requires an explicit URL — no default target", () => {
  assert.deepEqual(resolveMeshEmit({ connect: true, key: "c:s" }, NO_ENV), { kind: "skip", reason: "missingUrl" });
});
