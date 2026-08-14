import { parseArgs } from "node:util";
import type { Locale } from "@iden-q/scanner-lib";
import { requireSession, NotLoggedInError, type ActiveSession } from "../auth/session.js";
import { resolveLocale } from "../locale.js";
import { out, err, palette } from "../theme.js";

// `q-scanner whoami` — who the stored session belongs to. Refreshes the token if
// it has expired (so this doubles as "is my session still alive?"), then prints
// the identity, roles, environment, and whether the login was passkey-stepped-up
// (`acr=aal2`). Not logged in → a clear message and exit 1, so a script can gate
// on it.

const COPY: Record<
  Locale,
  {
    account: (who: string) => string;
    roles: (roles: string) => string;
    noRoles: string;
    environment: (url: string) => string;
    passkey: string;
    notLoggedIn: string;
  }
> = {
  es: {
    account: (who) => `Cuenta:  ${who}`,
    roles: (roles) => `Roles:   ${roles}`,
    noRoles: "Roles:   (ninguno)",
    environment: (url) => `Entorno: ${url}`,
    passkey: "Verificado con passkey (aal2).",
    notLoggedIn: "No has iniciado sesión. Ejecuta `q-scanner login`.",
  },
  en: {
    account: (who) => `Account:     ${who}`,
    roles: (roles) => `Roles:       ${roles}`,
    noRoles: "Roles:       (none)",
    environment: (url) => `Environment: ${url}`,
    passkey: "Stepped up with a passkey (aal2).",
    notLoggedIn: "Not logged in. Run `q-scanner login`.",
  },
};

export async function whoamiCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { lang: { type: "string", default: "en" } },
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

  const claims = session.claims;
  const who = claims?.email ?? claims?.sub ?? "unknown";
  process.stdout.write(`${out.bold(copy.account(who))}\n`);
  process.stdout.write(`${claims && claims.roles.length ? copy.roles(claims.roles.join(", ")) : copy.noRoles}\n`);
  process.stdout.write(`${copy.environment(session.apiUrl)}\n`);
  if (claims?.acr === "aal2") process.stdout.write(`${out.dim(copy.passkey)}\n`);
}
