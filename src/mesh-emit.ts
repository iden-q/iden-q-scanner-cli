import type { Finding, Locale } from "@iden-q/scanner-lib";
import { createMeshClient, observationsFromFindings, emitObservations } from "@iden-q/scanner-lib/node";
import { err, palette } from "./theme.js";

// `--connect-mesh`: the CLI is standalone by default and only reaches the network
// when explicitly connected. Emission is off the scan's critical path — a mesh
// that is unreachable, misconfigured, or slow never changes the scan's result or
// exit code; the worst case is a warning on stderr.
//
// The credential is client_credentials (an API key: clientId + secret). It can
// come inline (`--mesh-key clientId:apiKey`) or, since the CLI runs in DevOps
// pipelines, from the environment (`IDENQ_MESH_CLIENT_ID` / `IDENQ_MESH_API_KEY`)
// so the secret need never appear in argv. The mesh URL is required and has no
// default — emitting to a mesh is always a named target (`--mesh-url` or
// `IDENQ_MESH_URL`), never an accidental production write.

export interface MeshEmitOptions {
  connect?: boolean;
  key?: string;
  url?: string;
}

export interface MeshEmitConfig {
  clientId: string;
  apiKey: string;
  baseUrl: string;
}

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
    nothing: string;
    emitting: (url: string) => string;
    delivered: (accepted: number, nodes: number, edges: number) => string;
    partial: (failed: number, firstError: string) => string;
  }
> = {
  es: {
    badKey: "--mesh-key debe tener el formato clientId:apiKey; no se emite al mesh.",
    missingCredential:
      "--connect-mesh: falta la credencial (usa --mesh-key clientId:apiKey o IDENQ_MESH_CLIENT_ID/IDENQ_MESH_API_KEY); no se emite.",
    missingUrl: "--connect-mesh: falta la URL del mesh (--mesh-url o IDENQ_MESH_URL); no se emite.",
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
      "--connect-mesh: missing credential (use --mesh-key clientId:apiKey or IDENQ_MESH_CLIENT_ID/IDENQ_MESH_API_KEY); not emitting.",
    missingUrl: "--connect-mesh: missing mesh URL (--mesh-url or IDENQ_MESH_URL); not emitting.",
    nothing: "Mesh: nothing to emit (no key-establishment observations).",
    emitting: (url) => `Mesh: emitting anonymous telemetry to ${url}…`,
    delivered: (accepted, nodes, edges) =>
      `Mesh: ${accepted} observations accepted (${nodes} nodes, ${edges} edges).`,
    partial: (failed, firstError) =>
      `Mesh: ${failed} batch(es) undelivered (${firstError}); the scan is unaffected.`,
  },
};

/** Resolve the mesh-emit intent from flags + environment, without touching the
 * network. `off` = not opted in; `skip` = opted in but not configured (the caller
 * warns and carries on); `emit` = ready. Pure, so it is the unit-tested core. */
export function resolveMeshEmit(
  options: MeshEmitOptions,
  env: Record<string, string | undefined>
): MeshResolution {
  if (!options.connect) return { kind: "off" };

  let clientId: string | undefined;
  let apiKey: string | undefined;
  if (options.key !== undefined) {
    // Split on the first ":" — a client_id is a UUID (no colons) and the key is
    // the remainder, so a secret that itself contains ":" survives intact.
    const idx = options.key.indexOf(":");
    if (idx <= 0 || idx === options.key.length - 1) return { kind: "skip", reason: "badKey" };
    clientId = options.key.slice(0, idx);
    apiKey = options.key.slice(idx + 1);
  } else {
    clientId = env.IDENQ_MESH_CLIENT_ID;
    apiKey = env.IDENQ_MESH_API_KEY;
  }
  if (!clientId || !apiKey) return { kind: "skip", reason: "missingCredential" };

  const baseUrl = options.url ?? env.IDENQ_MESH_URL;
  if (!baseUrl) return { kind: "skip", reason: "missingUrl" };

  return { kind: "emit", config: { clientId, apiKey, baseUrl } };
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

  console.error(err.fg(palette.cytosineAqua, copy.emitting(config.baseUrl)));
  const client = createMeshClient({
    baseUrl: config.baseUrl,
    credential: { clientId: config.clientId, clientSecret: config.apiKey },
    locale,
  });
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
