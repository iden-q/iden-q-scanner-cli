import type { Finding, Locale } from "@iden-q/scanner-lib";
import { createMeshClient, observationsFromFindings, emitObservations } from "@iden-q/scanner-lib/node";
import type { MeshClientCredential } from "@iden-q/scanner-lib/node";
import { signingKeysFromPrivateJwk, sign as mldsaSign, mldsaSignature } from "@iden-q/post-quantum";
import { err, palette } from "./theme.js";

// `--connect-mesh`: the CLI is standalone by default and only reaches the network
// when explicitly connected. Emission is off the scan's critical path — a mesh
// that is unreachable, misconfigured, or slow never changes the scan's result or
// exit code; the worst case is a warning on stderr.
//
// Two credential modes the mesh accepts, both carried here:
//   - client_credentials — an API key (clientId + secret). Inline
//     (`--mesh-key clientId:apiKey`) or, since the CLI runs in DevOps pipelines,
//     from the environment (`IDENQ_MESH_CLIENT_ID` / `IDENQ_MESH_API_KEY`).
//   - private_key_jwt — a public-key credential: the CLI holds the private half
//     as an ML-DSA-44 AKP JWK and signs a short-lived assertion per token. The
//     private key is a secret and never appears in argv: it comes only from
//     `IDENQ_MESH_PRIVATE_KEY` (the JWK JSON), with `IDENQ_MESH_CLIENT_ID`.
//
// The private key half never leaves this process: the JWK derives an ML-DSA-44
// signing key that signs assertions locally; only signatures and the public
// client id ever travel. The signing itself is `@iden-q/post-quantum`'s emitted
// ML-DSA-44 — the same library the console mints the JWK with — injected into
// scanner-lib's `MeshAssertionSigner`, so there is one implementation of the
// primitive across the estate.
//
// The mesh URL is required and has no default — emitting to a mesh is always a
// named target (`--mesh-url` or `IDENQ_MESH_URL`), never an accidental
// production write.

export interface MeshEmitOptions {
  connect?: boolean;
  key?: string;
  url?: string;
}

/** A resolved, ready-to-use mesh credential. Discriminated by `mode`: an API key
 * (client_credentials) or a private JWK (private_key_jwt). The private JWK is
 * carried as its raw JSON — parsing and key derivation happen at emit time in
 * `buildMeshCredential`, so `resolveMeshEmit` stays pure and free of crypto. */
export type MeshEmitConfig =
  | { mode: "apiKey"; clientId: string; apiKey: string; baseUrl: string }
  | { mode: "privateKey"; clientId: string; privateKeyJwk: string; baseUrl: string };

type SkipReason = "badKey" | "missingCredential" | "missingUrl";

export type MeshResolution =
  | { kind: "off" }
  | { kind: "skip"; reason: SkipReason }
  | { kind: "emit"; config: MeshEmitConfig };

const COPY: Record<
  Locale,
  {
    badKey: string;
    missingCredential: string;
    missingUrl: string;
    badPrivateKey: string;
    nothing: string;
    emitting: (url: string) => string;
    delivered: (accepted: number, nodes: number, edges: number) => string;
    partial: (failed: number, firstError: string) => string;
  }
> = {
  es: {
    badKey: "--mesh-key debe tener el formato clientId:apiKey; no se emite al mesh.",
    missingCredential:
      "--connect-mesh: falta la credencial (usa --mesh-key clientId:apiKey, IDENQ_MESH_CLIENT_ID/IDENQ_MESH_API_KEY, o IDENQ_MESH_CLIENT_ID/IDENQ_MESH_PRIVATE_KEY); no se emite.",
    missingUrl: "--connect-mesh: falta la URL del mesh (--mesh-url o IDENQ_MESH_URL); no se emite.",
    badPrivateKey:
      "--connect-mesh: IDENQ_MESH_PRIVATE_KEY no es un JWK ML-DSA-44 válido; no se emite al mesh.",
    nothing: "Mesh: nada que emitir (ninguna observación de establecimiento de clave).",
    emitting: (url) => `Mesh: emitiendo telemetría anónima a ${url}…`,
    delivered: (accepted, nodes, edges) =>
      `Mesh: ${accepted} observaciones aceptadas (${nodes} nodos, ${edges} aristas).`,
    partial: (failed, firstError) =>
      `Mesh: ${failed} lote(s) no se entregaron (${firstError}); el escaneo no se ve afectado.`,
  },
  en: {
    badKey: "--mesh-key must be clientId:apiKey; not emitting to the mesh.",
    missingCredential:
      "--connect-mesh: missing credential (use --mesh-key clientId:apiKey, IDENQ_MESH_CLIENT_ID/IDENQ_MESH_API_KEY, or IDENQ_MESH_CLIENT_ID/IDENQ_MESH_PRIVATE_KEY); not emitting.",
    missingUrl: "--connect-mesh: missing mesh URL (--mesh-url or IDENQ_MESH_URL); not emitting.",
    badPrivateKey:
      "--connect-mesh: IDENQ_MESH_PRIVATE_KEY is not a valid ML-DSA-44 JWK; not emitting to the mesh.",
    nothing: "Mesh: nothing to emit (no key-establishment observations).",
    emitting: (url) => `Mesh: emitting anonymous telemetry to ${url}…`,
    delivered: (accepted, nodes, edges) =>
      `Mesh: ${accepted} observations accepted (${nodes} nodes, ${edges} edges).`,
    partial: (failed, firstError) =>
      `Mesh: ${failed} batch(es) undelivered (${firstError}); the scan is unaffected.`,
  },
};

/** Resolve the mesh-emit intent from flags + environment, without touching the
 * network or any crypto. `off` = not opted in; `skip` = opted in but not
 * configured (the caller warns and carries on); `emit` = ready. Pure, so it is
 * the unit-tested core.
 *
 * Credential precedence: an inline `--mesh-key` is the most explicit and wins.
 * Otherwise a private JWK in the environment is preferred over an API key —
 * public-key auth is the stronger of the two, so when both are configured the
 * key that never sends a shared secret is the one used. */
export function resolveMeshEmit(
  options: MeshEmitOptions,
  env: Record<string, string | undefined>
): MeshResolution {
  if (!options.connect) return { kind: "off" };

  const baseUrl = options.url ?? env.IDENQ_MESH_URL;

  const credential = resolveCredential(options, env);
  if (credential.kind === "skip") return credential;

  // URL is checked after the credential so "missing credential" is reported
  // before "missing URL" when both are absent — the credential is the thing a
  // user most often forgets, and one message at a time is clearer.
  if (!baseUrl) return { kind: "skip", reason: "missingUrl" };

  return { kind: "emit", config: { ...credential.config, baseUrl } };
}

type CredentialResolution =
  | { kind: "skip"; reason: SkipReason }
  | { kind: "ok"; config: Omit<Extract<MeshEmitConfig, { mode: "apiKey" }>, "baseUrl"> | Omit<Extract<MeshEmitConfig, { mode: "privateKey" }>, "baseUrl"> };

function resolveCredential(options: MeshEmitOptions, env: Record<string, string | undefined>): CredentialResolution {
  if (options.key !== undefined) {
    // Split on the first ":" — a client_id is a UUID (no colons) and the key is
    // the remainder, so a secret that itself contains ":" survives intact.
    const idx = options.key.indexOf(":");
    if (idx <= 0 || idx === options.key.length - 1) return { kind: "skip", reason: "badKey" };
    return {
      kind: "ok",
      config: { mode: "apiKey", clientId: options.key.slice(0, idx), apiKey: options.key.slice(idx + 1) },
    };
  }

  const clientId = env.IDENQ_MESH_CLIENT_ID;
  const privateKeyJwk = env.IDENQ_MESH_PRIVATE_KEY;
  const apiKey = env.IDENQ_MESH_API_KEY;

  if (clientId && privateKeyJwk) {
    return { kind: "ok", config: { mode: "privateKey", clientId, privateKeyJwk } };
  }
  if (clientId && apiKey) {
    return { kind: "ok", config: { mode: "apiKey", clientId, apiKey } };
  }
  return { kind: "skip", reason: "missingCredential" };
}

/** Raised by `buildMeshCredential` when a private JWK cannot be read. Telemetry
 * is best-effort, so `runMeshEmit` catches this and warns rather than throwing. */
export class MeshCredentialError extends Error {}

/** Turn a resolved config into the scanner-lib credential. For the private-key
 * mode this parses the JWK and derives the ML-DSA-44 signing key ONCE, closing
 * over it so each assertion is signed without re-deriving. Throws
 * `MeshCredentialError` on a malformed JWK. */
export function buildMeshCredential(config: MeshEmitConfig): MeshClientCredential {
  if (config.mode === "apiKey") {
    return { clientId: config.clientId, clientSecret: config.apiKey };
  }
  let sk: Uint8Array;
  try {
    const jwk = mldsaSignature.mldsa44PrivateJwkFromJson(JSON.parse(config.privateKeyJwk) as unknown);
    ({ sk } = signingKeysFromPrivateJwk(jwk));
  } catch (cause) {
    throw new MeshCredentialError("invalid ML-DSA-44 private JWK", { cause });
  }
  // The private key stays in this closure; only the 2420-byte signature leaves.
  return { clientId: config.clientId, sign: (message) => mldsaSign(sk, message).signature };
}

/** Emit a scan's findings to the mesh. Never throws — telemetry is off the scan's
 * critical path — so any failure is a stderr warning, not an exception. */
export async function runMeshEmit(
  findings: readonly Finding[],
  config: MeshEmitConfig,
  locale: Locale
): Promise<void> {
  const copy = COPY[locale];
  const observations = observationsFromFindings(findings);
  if (observations.length === 0) {
    console.error(err.dim(copy.nothing));
    return;
  }

  let credential: MeshClientCredential;
  try {
    credential = buildMeshCredential(config);
  } catch {
    console.error(err.fg(palette.warning, copy.badPrivateKey));
    return;
  }

  console.error(err.fg(palette.cytosineAqua, copy.emitting(config.baseUrl)));
  const client = createMeshClient({ baseUrl: config.baseUrl, credential, locale });
  const summary = await emitObservations(client, observations);

  console.error(err.fg(palette.success, copy.delivered(summary.accepted, summary.nodes, summary.edges)));
  if (summary.failed > 0) {
    console.error(err.fg(palette.warning, copy.partial(summary.failed, summary.firstError ?? "unknown")));
  }
}

/** The opt-in entry point for a command: resolve, warn-and-skip if misconfigured,
 * or emit. Safe to call unconditionally — it does nothing unless `--connect-mesh`. */
export async function maybeEmitToMesh(
  findings: readonly Finding[],
  options: MeshEmitOptions,
  locale: Locale
): Promise<void> {
  const resolution = resolveMeshEmit(options, process.env);
  if (resolution.kind === "off") return;
  if (resolution.kind === "skip") {
    console.error(err.fg(palette.warning, COPY[locale][resolution.reason]));
    return;
  }
  await runMeshEmit(findings, resolution.config, locale);
}
