import { randomUUID } from "node:crypto";
import type { ScanResult } from "@iden-q/scanner-lib";
import type { ProbeResult } from "@iden-q/scanner-lib/node";

// The cloud scan-history SNAPSHOT — the exact shape iden-q-quantum-scanner stores
// at `/quantum/scans` (`src/lib/scan-context.tsx`). It is ONE evolving snapshot
// per user (the backend keeps a single row, `SNAPSHOT_SK`), shared by every
// surface that saves to it. So the CLI must READ-MODIFY-WRITE, never blind-write:
// a `scan --save` appends its session to the same `folderSessions`/`domainSessions`
// the web reads, so a CLI scan shows up in the web dashboard and a blind write
// would clobber the web's history (and vice versa).
//
// A "session" is one SCAN ACTION (a folder/paste, or a domain check), not one
// file/domain — that is what lets the dashboard show "175 files" as one grouped
// row. Sessions are de-duplicated by `id` and ordered by `timestamp`, matching
// the web's `mergeById`, so re-saving is idempotent.

/** One folder/paste scan action and its per-file results. */
export interface FolderSession {
  id: string;
  timestamp: number;
  label: string;
  results: ScanResult[];
}

/** One domain scan action and its probe result(s). */
export interface DomainSession {
  id: string;
  timestamp: number;
  label: string;
  results: ProbeResult[];
}

/** The whole per-user snapshot. */
export interface Snapshot {
  folderSessions: FolderSession[];
  domainSessions: DomainSession[];
}

export function emptySnapshot(): Snapshot {
  return { folderSessions: [], domainSessions: [] };
}

/** Coerce whatever `/quantum/scans` returned (which the web may have written, or
 * which may be absent/garbled) into a well-formed snapshot — arrays guaranteed,
 * exactly like the web's `loadHistory`. Never throws. */
export function normalizeSnapshot(raw: unknown): Snapshot {
  if (!raw || typeof raw !== "object") return emptySnapshot();
  const record = raw as { folderSessions?: unknown; domainSessions?: unknown };
  return {
    folderSessions: Array.isArray(record.folderSessions) ? (record.folderSessions as FolderSession[]) : [],
    domainSessions: Array.isArray(record.domainSessions) ? (record.domainSessions as DomainSession[]) : [],
  };
}

/** De-duplicate by `id` (so re-saving one snapshot is idempotent) and order by
 * scan time — the web's `mergeById`, kept identical so both surfaces converge on
 * the same ordered history. */
function mergeById<T extends { id: string; timestamp: number }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((s) => s.id));
  return existing.concat(incoming.filter((s) => !seen.has(s.id))).sort((a, b) => a.timestamp - b.timestamp);
}

/** A new session with a fresh id and timestamp (epoch ms, the backend convention). */
export function newFolderSession(label: string, results: ScanResult[], now: number): FolderSession {
  return { id: randomUUID(), timestamp: now, label, results };
}

export function newDomainSession(label: string, results: ProbeResult[], now: number): DomainSession {
  return { id: randomUUID(), timestamp: now, label, results };
}

/** Append a folder session to a snapshot (returns a new snapshot). */
export function addFolderSession(snapshot: Snapshot, session: FolderSession): Snapshot {
  return { ...snapshot, folderSessions: mergeById(snapshot.folderSessions, [session]) };
}

/** Append a domain session to a snapshot (returns a new snapshot). */
export function addDomainSession(snapshot: Snapshot, session: DomainSession): Snapshot {
  return { ...snapshot, domainSessions: mergeById(snapshot.domainSessions, [session]) };
}
