import { parseArgs } from "node:util";
import { buildReport, buildCbom } from "@iden-q/scanner-lib";
import { probeDomain } from "@iden-q/scanner-lib/node";
import { printReport, printCbom, renderReportFile, renderCbomFile, defaultOutputPath, saveReportFile } from "../output.js";
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
      output: { type: "string" },
    },
    allowPositionals: true,
  });

  const locale = resolveLocale(values.lang);
  const domain = positionals[0];
  if (!domain) throw new Error("usage: q-scanner scan-domain <domain>");

  const spinner = new Spinner(`Probing ${domain}'s TLS certificate…`).start();
  const result = await probeDomain(domain, locale);
  spinner.stop();

  const format = values.format === "cbom" ? "cbom" : values.format === "json" ? "json" : "table";
  const report = buildReport([], [result], locale);
  let fileContent: string;

  if (format === "cbom") {
    const cbom = buildCbom([], [result]);
    printCbom(cbom, report.summary);
    fileContent = renderCbomFile(cbom);
  } else {
    printReport(report, format);
    fileContent = renderReportFile(report, format);
  }

  await saveReportFile(values.output ?? defaultOutputPath(format), fileContent);

  if (!result.connected) {
    console.error(result.error ?? "connection failed");
    process.exitCode = 1;
    return;
  }
  applyFailOn(result.certificate?.severity ?? null, values["fail-on"]);
}
