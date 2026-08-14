#!/usr/bin/env node
import { scanCommand } from "./commands/scan.js";
import { scanDomainCommand } from "./commands/scan-domain.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { whoamiCommand } from "./commands/whoami.js";
import { historyCommand } from "./commands/history.js";
import { printBanner } from "./banner.js";
import { out, err, palette } from "./theme.js";

const USAGE = `${out.bold("Usage:")}
  ${out.fg(palette.helixBlueLight, "q-scanner scan <path>")}          Scan a file or folder for vulnerable crypto
  ${out.fg(palette.helixBlueLight, "q-scanner scan --stdin")}         Scan piped text (e.g. git diff | q-scanner scan --stdin)
  ${out.fg(palette.helixBlueLight, "q-scanner scan-domain <host>")}   Scan a domain's TLS certificate
  ${out.fg(palette.helixBlueLight, "q-scanner login")}                Sign in with a browser (device flow) to save scans to your account
  ${out.fg(palette.helixBlueLight, "q-scanner logout")}               Sign out and remove the stored session
  ${out.fg(palette.helixBlueLight, "q-scanner whoami")}               Show the signed-in account, roles, and environment
  ${out.fg(palette.helixBlueLight, "q-scanner history")}              List your cloud scan history (--clear to delete it)

${out.bold("Options:")}
  --format <table|json|cbom>     Output format (default: table); cbom emits a CycloneDX Cryptography Bill of Materials
  --lang <en|es>                  Output language (default: en)
  --output <path>                 Where to write the report file (default: ./q-scanner-report.<ext>, written every run)
  --fail-on <critical|high|medium|low>
                                  Exit 1 if the worst finding meets/exceeds this severity — wire into CI to gate a build
  --save                          Save the scan to your cloud history (requires q-scanner login). Off the critical path.
  --connect-mesh                  Emit anonymous CBOM telemetry to the iden-q mesh (both scan and scan-domain;
                                  standalone by default). Never affects the scan result or exit code.
  --mesh-key <clientId:apiKey>    Mesh API key inline; or set IDENQ_MESH_CLIENT_ID + IDENQ_MESH_API_KEY (preferred in CI).
                                  Public-key auth instead: IDENQ_MESH_CLIENT_ID + IDENQ_MESH_PRIVATE_KEY (the ML-DSA-44
                                  JWK; env-only, never argv). A private JWK is preferred over an API key when both are set.
  --mesh-url <url>                Mesh base URL; or IDENQ_MESH_URL. Required to emit — there is no default target.
  --api-url <url>                 Platform API base for login (or IDENQ_API_URL). Default: https://idenq.io/api/v1 (prod).
  -h, --help                     Show this help
`;

const [command, ...rest] = process.argv.slice(2);

if (command === "-h" || command === "--help") {
  printBanner();
  console.log(USAGE);
  process.exit(0);
}

if (!command) {
  console.log(`q-scanner — post-quantum cryptography exposure scanner\n\n${USAGE}`);
  process.exit(1);
}

try {
  if (command === "scan") {
    await scanCommand(rest);
  } else if (command === "scan-domain") {
    await scanDomainCommand(rest);
  } else if (command === "login") {
    await loginCommand(rest);
  } else if (command === "logout") {
    await logoutCommand(rest);
  } else if (command === "whoami") {
    await whoamiCommand(rest);
  } else if (command === "history") {
    await historyCommand(rest);
  } else {
    console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
    process.exit(1);
  }
} catch (error) {
  console.error(err.fg(palette.error, error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
