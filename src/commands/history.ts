import { parseArgs } from "node:util";
import type { Locale } from "@iden-q/scanner-lib";
import { requireSession, NotLoggedInError, type ActiveSession } from "../auth/session.js";
import { getSnapshot, deleteSnapshot } from "../auth/idenq-api.js";
import { resolveLocale } from "../locale.js";
import { out, err, palette } from "../theme.js";

// `q-scanner history` — the user's cloud scan history (`/quantum/scans`), the same
// snapshot the web dashboard shows. Read-only by default; `--clear` deletes it.
// Requires a login.

const COPY: Record<
  Locale,
  {
    notLoggedIn: string;
    empty: string;
    folders: string;
    domains: string;
    files: (n: number) => string;
    probes: (n: number) => string;
    cleared: string;
  }
> = {
  es: {
    notLoggedIn: "No has iniciado sesión. Ejecuta `q-scanner login`.",
    empty: "No hay escaneos guardados en la nube.",
    folders: "Carpetas/pegados:",
    domains: "Dominios:",
    files: (n) => `${n} archivo(s)`,
    probes: (n) => `${n} dominio(s)`,
    cleared: "Historial en la nube borrado.",
  },
  en: {
    notLoggedIn: "Not logged in. Run `q-scanner login`.",
    empty: "No saved scans in the cloud.",
    folders: "Folders/pastes:",
    domains: "Domains:",
    files: (n) => `${n} file(s)`,
    probes: (n) => `${n} domain(s)`,
    cleared: "Cloud history cleared.",
  },
};

/** `1699999999999` → `2026-08-14 13:59` (UTC, seconds dropped) — stable and
 * sortable, not locale-dependent. */
function formatTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16);
}

export async function historyCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { lang: { type: "string", default: "en" }, clear: { type: "boolean", default: false } },
    allowPositionals: false,
  });
  const copy = COPY[resolveLocale(values.lang)];

  let session: ActiveSession | undefined;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      process.stderr.write(`${err.fg(palette.warning, copy.notLoggedIn)}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  if (!session) return;

  if (values.clear) {
    await deleteSnapshot(session.apiUrl, session.accessToken);
    process.stderr.write(`${err.fg(palette.success, copy.cleared)}\n`);
    return;
  }

  const snapshot = await getSnapshot(session.apiUrl, session.accessToken);
  if (!snapshot || (snapshot.folderSessions.length === 0 && snapshot.domainSessions.length === 0)) {
    process.stdout.write(`${copy.empty}\n`);
    return;
  }

  if (snapshot.folderSessions.length) {
    process.stdout.write(`${out.bold(copy.folders)}\n`);
    for (const s of snapshot.folderSessions) {
      process.stdout.write(`  ${out.dim(formatTime(s.timestamp))}  ${s.label}  ${out.dim(copy.files(s.results.length))}\n`);
    }
  }
  if (snapshot.domainSessions.length) {
    process.stdout.write(`${out.bold(copy.domains)}\n`);
    for (const s of snapshot.domainSessions) {
      process.stdout.write(`  ${out.dim(formatTime(s.timestamp))}  ${s.label}  ${out.dim(copy.probes(s.results.length))}\n`);
    }
  }
}
