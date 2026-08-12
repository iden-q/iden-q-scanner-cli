import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveSigningKeys, verify } from "@iden-q/post-quantum";
import { resolveMeshEmit, buildMeshCredential, MeshCredentialError } from "./mesh-emit.js";

const NO_ENV: Record<string, string | undefined> = {};

/** A deterministic, valid ML-DSA-44 AKP JWK, built the way the console mints one:
 * `priv` is the base64url seed, `pub` the base64url verification key. */
function fixtureJwk(): { json: string; pk: Uint8Array } {
  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) seed[i] = i + 1;
  const keys = deriveSigningKeys(seed);
  const b64u = (u: Uint8Array) => Buffer.from(u).toString("base64url");
  return { json: JSON.stringify({ kty: "AKP", alg: "ML-DSA-44", priv: b64u(seed), pub: b64u(keys.pk) }), pk: keys.pk };
}

test("resolveMeshEmit is off when --connect-mesh is absent", () => {
  assert.deepEqual(resolveMeshEmit({}, NO_ENV), { kind: "off" });
  assert.deepEqual(resolveMeshEmit({ connect: false, key: "a:b", url: "https://x" }, NO_ENV), { kind: "off" });
});

test("resolveMeshEmit parses an inline --mesh-key clientId:apiKey", () => {
  const r = resolveMeshEmit({ connect: true, key: "client-1:iden_q_key_abc", url: "https://dev.idenq.io" }, NO_ENV);
  assert.deepEqual(r, {
    kind: "emit",
    config: { mode: "apiKey", clientId: "client-1", apiKey: "iden_q_key_abc", baseUrl: "https://dev.idenq.io" },
  });
});

test("resolveMeshEmit splits the key on the first colon so a secret may contain colons", () => {
  const r = resolveMeshEmit({ connect: true, key: "cid:iden:q:key", url: "https://x" }, NO_ENV);
  assert.equal(r.kind, "emit");
  if (r.kind === "emit" && r.config.mode === "apiKey") {
    assert.equal(r.config.clientId, "cid");
    assert.equal(r.config.apiKey, "iden:q:key");
  } else {
    assert.fail("expected an apiKey emit");
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

test("resolveMeshEmit falls back to env API-key credentials when no inline key is given", () => {
  const env = { IDENQ_MESH_CLIENT_ID: "env-client", IDENQ_MESH_API_KEY: "env-secret", IDENQ_MESH_URL: "https://idenq.io" };
  assert.deepEqual(resolveMeshEmit({ connect: true }, env), {
    kind: "emit",
    config: { mode: "apiKey", clientId: "env-client", apiKey: "env-secret", baseUrl: "https://idenq.io" },
  });
});

test("resolveMeshEmit reads a private JWK (private_key_jwt) from the environment", () => {
  const env = {
    IDENQ_MESH_CLIENT_ID: "env-client",
    IDENQ_MESH_PRIVATE_KEY: '{"kty":"AKP","alg":"ML-DSA-44","priv":"AAA","pub":"BBB"}',
    IDENQ_MESH_URL: "https://idenq.io",
  };
  assert.deepEqual(resolveMeshEmit({ connect: true }, env), {
    kind: "emit",
    config: {
      mode: "privateKey",
      clientId: "env-client",
      privateKeyJwk: env.IDENQ_MESH_PRIVATE_KEY,
      baseUrl: "https://idenq.io",
    },
  });
});

test("a private JWK is preferred over an API key when both are in the environment", () => {
  const env = {
    IDENQ_MESH_CLIENT_ID: "env-client",
    IDENQ_MESH_API_KEY: "env-secret",
    IDENQ_MESH_PRIVATE_KEY: '{"kty":"AKP"}',
    IDENQ_MESH_URL: "https://idenq.io",
  };
  const r = resolveMeshEmit({ connect: true }, env);
  assert.equal(r.kind, "emit");
  if (r.kind === "emit") assert.equal(r.config.mode, "privateKey");
});

test("an inline key takes precedence over env credentials", () => {
  const env = { IDENQ_MESH_CLIENT_ID: "env-client", IDENQ_MESH_API_KEY: "env-secret", IDENQ_MESH_URL: "https://idenq.io" };
  const r = resolveMeshEmit({ connect: true, key: "inline:inlinesecret" }, env);
  assert.equal(r.kind, "emit");
  if (r.kind === "emit" && r.config.mode === "apiKey") assert.equal(r.config.clientId, "inline");
  else assert.fail("expected an inline apiKey emit");
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
  // Half a credential is still missing — a client id with neither api key nor JWK.
  assert.deepEqual(resolveMeshEmit({ connect: true, url: "https://x" }, { IDENQ_MESH_CLIENT_ID: "only-id" }), {
    kind: "skip",
    reason: "missingCredential",
  });
  // A private JWK with no client id is also incomplete.
  assert.deepEqual(resolveMeshEmit({ connect: true, url: "https://x" }, { IDENQ_MESH_PRIVATE_KEY: "{}" }), {
    kind: "skip",
    reason: "missingCredential",
  });
});

test("resolveMeshEmit requires an explicit URL — no default target", () => {
  assert.deepEqual(resolveMeshEmit({ connect: true, key: "c:s" }, NO_ENV), { kind: "skip", reason: "missingUrl" });
});

test("buildMeshCredential returns an API-key credential unchanged", () => {
  const credential = buildMeshCredential({ mode: "apiKey", clientId: "c", apiKey: "s", baseUrl: "https://x" });
  assert.deepEqual(credential, { clientId: "c", clientSecret: "s" });
});

test("buildMeshCredential derives a signer whose signature verifies under the JWK's key", async () => {
  const { json, pk } = fixtureJwk();
  const credential = buildMeshCredential({ mode: "privateKey", clientId: "c", privateKeyJwk: json, baseUrl: "https://x" });
  assert.equal(credential.clientId, "c");
  assert.ok("sign" in credential, "expected a private_key_jwt signer credential");
  if (!("sign" in credential)) return;

  const message = new TextEncoder().encode("mesh assertion signing input");
  const signature = await credential.sign(message);
  assert.equal(signature.length, 2420, "an ML-DSA-44 signature is 2420 bytes");
  // The signature must verify under the JWK's own public key — proof the signing
  // key was derived from the seed, exactly what the mesh verifier will check.
  const recovered = verify({ message, signature }, pk);
  assert.deepEqual(recovered, message);
});

test("buildMeshCredential throws MeshCredentialError on a malformed private JWK", () => {
  assert.throws(
    () => buildMeshCredential({ mode: "privateKey", clientId: "c", privateKeyJwk: "not json", baseUrl: "https://x" }),
    MeshCredentialError,
  );
  assert.throws(
    () => buildMeshCredential({ mode: "privateKey", clientId: "c", privateKeyJwk: '{"kty":"WRONG"}', baseUrl: "https://x" }),
    MeshCredentialError,
  );
});
