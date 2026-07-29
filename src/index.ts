#!/usr/bin/env node
import { scanCommand } from "./commands/scan.js";
import { scanDomainCommand } from "./commands/scan-domain.js";
import { printBanner } from "./banner.js";
import { out, err, palette } from "./theme.js";

const USAGE = `${out.bold("Usage:")}
  ${out.fg(palette.helixBlueLight, "q-scanner scan <path>")}          Scan a file or folder for vulnerable crypto
  ${out.fg(palette.helixBlueLight, "q-scanner scan --stdin")}         Scan piped text (e.g. git diff | q-scanner scan --stdin)
  ${out.fg(palette.helixBlueLight, "q-scanner scan-domain <host>")}   Scan a domain's TLS certificate

${out.bold("Options:")}
  --format <table|json|cbom>     Output format (default: table); cbom emits a CycloneDX Cryptography Bill of Materials
  --lang <en|es>                  Output language (default: en)
  --fail-on <critical|high|medium|low>
                                  Exit 1 if the worst finding meets/exceeds this severity — wire into CI to gate a build
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
  } else {
    console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
    process.exit(1);
  }
} catch (error) {
  console.error(err.fg(palette.error, error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
