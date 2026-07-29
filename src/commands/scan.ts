import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  scanTextForCrypto,
  scanBinaryForCrypto,
  getSeverity,
  worstSeverity,
  buildReport,
  buildCbom,
  type ScanResult,
} from "@iden-q/scanner-lib";
import { walk, isBinaryCert } from "../fs-walk.js";
import { printReport, printCbom, renderReportFile, renderCbomFile, defaultOutputPath, saveReportFile } from "../output.js";
import { applyFailOn } from "../severity-gate.js";
import { resolveLocale } from "../locale.js";
import { Spinner } from "../spinner.js";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export async function scanCommand(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      stdin: { type: "boolean", default: false },
      format: { type: "string", default: "table" },
      lang: { type: "string", default: "en" },
      "fail-on": { type: "string" },
      output: { type: "string" },
    },
    allowPositionals: true,
  });

  const locale = resolveLocale(values.lang);
  const results: ScanResult[] = [];

  if (values.stdin) {
    const text = await readStdin();
    results.push({
      id: "stdin",
      fileName: "stdin",
      filePath: "-",
      findings: scanTextForCrypto(text, "stdin", locale),
    });
  } else {
    const target = positionals[0];
    if (!target) throw new Error("usage: q-scanner scan <path> | --stdin");

    const spinner = new Spinner(`Discovering files in ${target}…`).start();
    const files = await walk(target);
    for (const [i, file] of files.entries()) {
      spinner.update(`Scanning ${target}… (${i + 1}/${files.length})`);
      let buf: Buffer;
      try {
        buf = await readFile(file.absolutePath);
      } catch {
        continue; // unreadable file (permissions/IO) — skip, not fatal to the scan
      }
      const findings = scanTextForCrypto(buf.toString("utf8"), file.path, locale);
      if (isBinaryCert(file.path)) {
        findings.push(...scanBinaryForCrypto(new Uint8Array(buf), file.path, locale));
      }
      results.push({ id: file.path, fileName: file.path, filePath: file.absolutePath, findings });
    }
    spinner.stop();
  }

  const format = values.format === "cbom" ? "cbom" : values.format === "json" ? "json" : "table";
  const report = buildReport(results, [], locale);
  let fileContent: string;

  if (format === "cbom") {
    const cbom = buildCbom(results, []);
    printCbom(cbom, report.summary);
    fileContent = renderCbomFile(cbom);
  } else {
    printReport(report, format);
    fileContent = renderReportFile(report, format);
  }

  await saveReportFile(values.output ?? defaultOutputPath(format), fileContent);

  const worst = worstSeverity(results.flatMap((r) => r.findings).map(getSeverity));
  applyFailOn(worst, values["fail-on"]);
}
