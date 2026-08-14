import { parseArgs } from "node:util";
import type { Locale } from "@iden-q/scanner-lib";
import { resolveApiUrl } from "../api/config.js";
import { requestDeviceCode, pollForToken, DeviceFlowError, type DeviceTokenResponse } from "../auth/device-flow.js";
import { grantSelfAccess } from "../auth/idenq-api.js";
import { refreshAccessToken, decodeToken } from "../auth/token.js";
import { writeSession } from "../auth/session-store.js";
import { resolveLocale } from "../locale.js";
import { out, err, palette } from "../theme.js";
import { Spinner } from "../spinner.js";

// `q-scanner login` — the RFC 8628 device-flow ceremony. The CLI asks for a code,
// tells the person where to approve it, waits, and stores the person token. After
// approval it self-grants `scanner:user` and refreshes so the stored token can
// save scans to the cloud straight away. The CLI never holds a static secret —
// only the short-lived tokens this writes.

const COPY: Record<
  Locale,
  {
    open: (uri: string) => string;
    enter: (code: string) => string;
    direct: (uri: string) => string;
    waiting: string;
    denied: string;
    expired: string;
    grantFailed: string;
    loggedIn: (who: string) => string;
    roles: (roles: string) => string;
    noRoles: string;
  }
> = {
  es: {
    open: (uri) => `Abre en tu navegador:  ${uri}`,
    enter: (code) => `E introduce el código:  ${code}`,
    direct: (uri) => `O directamente:  ${uri}`,
    waiting: "Esperando aprobación en la consola…",
    denied: "La solicitud de login fue denegada en la consola.",
    expired: "La solicitud de login expiró antes de aprobarse. Vuelve a ejecutar login.",
    grantFailed: "Conectado, pero no se pudo habilitar el historial en la nube (scanner:user); --save puede fallar.",
    loggedIn: (who) => `Conectado como ${who}.`,
    roles: (roles) => `Roles: ${roles}.`,
    noRoles: "Sin roles adicionales.",
  },
  en: {
    open: (uri) => `Open in your browser:  ${uri}`,
    enter: (code) => `And enter the code:  ${code}`,
    direct: (uri) => `Or go straight to:  ${uri}`,
    waiting: "Waiting for approval in the console…",
    denied: "The login request was denied in the console.",
    expired: "The login request expired before it was approved. Run login again.",
    grantFailed: "Logged in, but could not enable cloud history (scanner:user); --save may fail.",
    loggedIn: (who) => `Logged in as ${who}.`,
    roles: (roles) => `Roles: ${roles}.`,
    noRoles: "No additional roles.",
  },
};

export async function loginCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      lang: { type: "string", default: "en" },
      "api-url": { type: "string" },
      scope: { type: "string" },
    },
    allowPositionals: false,
  });

  const locale = resolveLocale(values.lang);
  const copy = COPY[locale];
  const apiUrl = resolveApiUrl(values["api-url"]);

  const device = await requestDeviceCode(apiUrl, values.scope);

  // The code and URL go to stdout so they survive being piped or copied even when
  // stderr styling is on; the spinner and status go to stderr.
  process.stdout.write(`\n${out.bold(copy.open(device.verification_uri))}\n`);
  process.stdout.write(`${out.bold(out.fg(palette.cytosineAqua, copy.enter(device.user_code)))}\n`);
  process.stdout.write(`${out.dim(copy.direct(device.verification_uri_complete))}\n\n`);

  const spinner = new Spinner(copy.waiting).start();
  let token: DeviceTokenResponse | undefined;
  try {
    token = await pollForToken(apiUrl, device);
  } catch (error) {
    spinner.stop();
    if (error instanceof DeviceFlowError) {
      process.stderr.write(`${err.fg(palette.error, error.reason === "denied" ? copy.denied : copy.expired)}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
  spinner.stop();
  if (!token) return;

  // Enable the scanner product for this account and refresh so the stored token
  // carries `scanner:user` — best effort: a failure here still leaves a valid
  // person session, it just means `--save` may 403 until the grant lands.
  let accessToken = token.access_token;
  let refreshToken = token.refresh_token;
  try {
    await grantSelfAccess(apiUrl, accessToken);
    const refreshed = await refreshAccessToken(apiUrl, refreshToken);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken ?? refreshToken;
  } catch {
    process.stderr.write(`${err.fg(palette.warning, copy.grantFailed)}\n`);
  }

  await writeSession({ apiUrl, accessToken, refreshToken, obtainedAt: Date.now() });

  const claims = decodeToken(accessToken);
  const who = claims?.email ?? claims?.sub ?? "your account";
  process.stderr.write(`${err.fg(palette.success, copy.loggedIn(who))}\n`);
  process.stderr.write(
    `${err.dim(claims && claims.roles.length ? copy.roles(claims.roles.join(", ")) : copy.noRoles)}\n`,
  );
}
