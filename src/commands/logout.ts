import { parseArgs } from "node:util";
import type { Locale } from "@iden-q/scanner-lib";
import { readSession, clearSession } from "../auth/session-store.js";
import { postJson } from "../auth/http.js";
import { resolveLocale } from "../locale.js";
import { err, palette } from "../theme.js";

// `q-scanner logout` — revoke the session server-side (best effort) and remove the
// local token file. Clearing local state always succeeds, even if the revoke call
// cannot be made, so a user is never left unable to log out.

const COPY: Record<Locale, { done: string; wasNotLoggedIn: string }> = {
  es: { done: "Sesión cerrada.", wasNotLoggedIn: "No había ninguna sesión activa." },
  en: { done: "Logged out.", wasNotLoggedIn: "You were not logged in." },
};

export async function logoutCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { lang: { type: "string", default: "en" } },
    allowPositionals: false,
  });
  const copy = COPY[resolveLocale(values.lang)];

  const stored = await readSession();
  if (!stored) {
    process.stderr.write(`${err.dim(copy.wasNotLoggedIn)}\n`);
    return;
  }

  // Revoke the refresh token so it cannot be replayed. Best effort — a failed
  // revoke must not stop the local session from being cleared.
  try {
    await postJson(`${stored.apiUrl}/iam/auth/logout`, { refreshToken: stored.refreshToken }, stored.accessToken);
  } catch {
    // Ignore — clearing local state below is what "logged out" means to the user.
  }

  await clearSession();
  process.stderr.write(`${err.fg(palette.success, copy.done)}\n`);
}
