import { getJson, postJson, del } from "./http.js";
import { normalizeSnapshot, type Snapshot } from "./history.js";

// The person-scoped platform calls the CLI makes with the device-flow token —
// the same endpoints the web client (`iden-q-quantum-scanner/src/lib/idenq-api.ts`)
// uses, so a CLI login and a web login act on one account and one cloud history.

/** The product this CLI enables for the account, as the self-service endpoint
 * names it — never a role. The server maps the product to its role against a
 * fixed allowlist, so nothing the client sends can name a role off it. */
export const APPLICATION = "scanner";

/** The role that product grants. Used only to decide whether the grant is already
 * in a token; authorization is always the server's. */
export const APPLICATION_ROLE = "scanner:user";

/** Enable the scanner product for the calling account (self-service, idempotent).
 * The account's token still carries the roles it was minted with, so a refresh
 * has to follow before the new role is usable — the login flow does exactly that. */
export async function grantSelfAccess(apiUrl: string, token: string): Promise<void> {
  await postJson(`${apiUrl}/iam/auth/access/${APPLICATION}`, {}, token);
}

/** Read the user's cloud scan-history snapshot, or `null` when they have never
 * saved (or it was cleared). `/quantum/scans` answers the platform's paginated
 * `FindAllDto` (`{ data: [...], pagination }`) with a single per-user snapshot; we
 * take that item's `report` and normalise it into a well-formed snapshot. */
export async function getSnapshot(apiUrl: string, token: string): Promise<Snapshot | null> {
  const data = (await getJson(`${apiUrl}/quantum/scans`, token)) as {
    data?: Array<{ report?: unknown }>;
  } | null;
  const report = data?.data?.[0]?.report;
  if (report === undefined || report === null) return null;
  return normalizeSnapshot(report);
}

/** Overwrite the user's cloud snapshot. The caller must pass the FULL merged
 * snapshot (read-modify-write) — `/quantum/scans` stores one row per user, so this
 * replaces it wholesale; sending only the new session would erase the rest. */
export async function saveSnapshot(apiUrl: string, token: string, snapshot: Snapshot): Promise<void> {
  await postJson(`${apiUrl}/quantum/scans`, { report: snapshot }, token);
}

/** Soft-delete the user's cloud snapshot (clear history). */
export async function deleteSnapshot(apiUrl: string, token: string): Promise<void> {
  await del(`${apiUrl}/quantum/scans`, token);
}
