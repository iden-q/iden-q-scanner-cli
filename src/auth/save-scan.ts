import type { Locale, ScanResult } from "@iden-q/scanner-lib";
import type { ProbeResult } from "@iden-q/scanner-lib/node";
import { requireSession, NotLoggedInError } from "./session.js";
import { getSnapshot, saveSnapshot } from "./idenq-api.js";
import {
  addDomainSession,
  addFolderSession,
  emptySnapshot,
  newDomainSession,
  newFolderSession,
} from "./history.js";
import { err, palette } from "../theme.js";

// `--save`: push a completed scan into the user's cloud history. Read-modify-write
// (get the current snapshot, append this one session, write the whole thing back),
// because `/quantum/scans` is one shared per-user snapshot — see `history.ts`.
// Requires a live session (the login flow granted `scanner:user`); a missing or
// expired one surfaces as `NotLoggedInError`, which the command turns into "run
// `q-scanner login`". Kept off the scan's result: the caller runs the scan, prints
// and files it, THEN saves, so a save failure never changes findings or exit code.

/** How many sessions of each kind the snapshot holds after the save — for the
 * "saved to cloud (N in history)" line the command prints. */
export interface SaveOutcome {
  folderCount: number;
  domainCount: number;
}

async function persist(
  build: (base: ReturnType<typeof emptySnapshot>) => ReturnType<typeof emptySnapshot>,
  env: NodeJS.ProcessEnv,
): Promise<SaveOutcome> {
  const session = await requireSession(env);
  const current = (await getSnapshot(session.apiUrl, session.accessToken)) ?? emptySnapshot();
  const next = build(current);
  await saveSnapshot(session.apiUrl, session.accessToken, next);
  return { folderCount: next.folderSessions.length, domainCount: next.domainSessions.length };
}

/** Append a folder/paste scan to the user's cloud history. */
export function saveFolderScan(
  label: string,
  results: ScanResult[],
  env: NodeJS.ProcessEnv = process.env,
  now: number = Date.now(),
): Promise<SaveOutcome> {
  return persist((base) => addFolderSession(base, newFolderSession(label, results, now)), env);
}

/** Append a domain scan to the user's cloud history. */
export function saveDomainScan(
  label: string,
  results: ProbeResult[],
  env: NodeJS.ProcessEnv = process.env,
  now: number = Date.now(),
): Promise<SaveOutcome> {
  return persist((base) => addDomainSession(base, newDomainSession(label, results, now)), env);
}

const COPY: Record<
  Locale,
  { saved: (total: number) => string; notLoggedIn: string; failed: (reason: string) => string }
> = {
  es: {
    saved: (total) => `Guardado en el historial de la nube (${total} en total).`,
    notLoggedIn: "--save: no has iniciado sesión; ejecuta `q-scanner login`.",
    failed: (reason) => `--save: no se pudo guardar en la nube (${reason}); el escaneo no se ve afectado.`,
  },
  en: {
    saved: (total) => `Saved to cloud history (${total} total).`,
    notLoggedIn: "--save: not logged in; run `q-scanner login`.",
    failed: (reason) => `--save: could not save to the cloud (${reason}); the scan is unaffected.`,
  },
};

/** The opt-in `--save` entry for a command: save the scan to the cloud and report
 * the outcome, or warn and carry on. Never throws — like mesh emission, a save
 * failure is a stderr warning, never a change to the scan's findings or exit code.
 * Safe to call unconditionally: does nothing unless `save` is true. */
export async function maybeSaveFolder(
  save: boolean,
  label: string,
  results: ScanResult[],
  locale: Locale,
): Promise<void> {
  if (!save) return;
  await report(() => saveFolderScan(label, results), (o) => o.folderCount, locale);
}

export async function maybeSaveDomain(
  save: boolean,
  label: string,
  results: ProbeResult[],
  locale: Locale,
): Promise<void> {
  if (!save) return;
  await report(() => saveDomainScan(label, results), (o) => o.domainCount, locale);
}

async function report(
  save: () => Promise<SaveOutcome>,
  total: (outcome: SaveOutcome) => number,
  locale: Locale,
): Promise<void> {
  const copy = COPY[locale];
  try {
    const outcome = await save();
    console.error(err.fg(palette.success, copy.saved(total(outcome))));
  } catch (error) {
    if (error instanceof NotLoggedInError) {
      console.error(err.fg(palette.warning, copy.notLoggedIn));
      return;
    }
    console.error(err.fg(palette.warning, copy.failed(error instanceof Error ? error.message : String(error))));
  }
}
