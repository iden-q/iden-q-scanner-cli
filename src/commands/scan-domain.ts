import { parseArgs } from "node:util";
import { buildReport } from "@iden-q/scanner-lib";
import { probeDomain } from "@iden-q/scanner-lib/node";
import { printReport } from "../output.js";
import { applyFailOn } from "../severity-gate.js";
import { Spinner } from "../spinner.js";

export async function scanDomainCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      format: { type: "string", default: "table" },
      "fail-on": { type: "string" },
    },
    allowPositionals: true,
  });

  const domain = positionals[0];
  if (!domain) throw new Error("usage: q-scanner scan-domain <domain>");

  const spinner = new Spinner(`Probing ${domain}'s TLS certificate…`).start();
  const result = await probeDomain(domain);
  spinner.stop();

  const report = buildReport([], [result], "en");
  printReport(report, values.format === "json" ? "json" : "table");

  if (!result.connected) {
    console.error(result.error ?? "connection failed");
    process.exitCode = 1;
    return;
  }
  applyFailOn(result.certificate?.severity ?? null, values["fail-on"]);
}
