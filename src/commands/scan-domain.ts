import { parseArgs } from "node:util";
import { buildReport, buildCbom } from "@iden-q/scanner-lib";
import { probeDomain } from "@iden-q/scanner-lib/node";
import { printReport, printCbom } from "../output.js";
import { applyFailOn } from "../severity-gate.js";
import { resolveLocale } from "../locale.js";
import { Spinner } from "../spinner.js";

export async function scanDomainCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", default: "table" },
      lang: { type: "string", default: "en" },
      "fail-on": { type: "string" },
    },
    allowPositionals: true,
  });

  const locale = resolveLocale(values.lang);
  const domain = positionals[0];
  if (!domain) throw new Error("usage: q-scanner scan-domain <domain>");

  const spinner = new Spinner(`Probing ${domain}'s TLS certificate…`).start();
  const result = await probeDomain(domain, locale);
  spinner.stop();

  if (values.format === "cbom") {
    printCbom(buildCbom([], [result]));
  } else {
    const report = buildReport([], [result], locale);
    printReport(report, values.format === "json" ? "json" : "table");
  }

  if (!result.connected) {
    console.error(result.error ?? "connection failed");
    process.exitCode = 1;
    return;
  }
  applyFailOn(result.certificate?.severity ?? null, values["fail-on"]);
}
