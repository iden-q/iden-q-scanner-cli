import { writeFile } from "node:fs/promises";
import type { Cbom, Severity } from "@iden-q/scanner-lib";
import { palette, out, err, type Painter, SEVERITY_COLOR, SEVERITY_ICON } from "./theme.js";

interface FindingLike {
  algorithm: string;
  severity?: Severity;
  location: string;
}

export interface Report {
  summary: { totalScans: number; criticalCount: number; overallQes: number | null };
  files: Array<{ fileName: string; findings: FindingLike[] }>;
  domains: Array<{ domain: string; certificate: { findings: FindingLike[] } | null }>;
}

// Never colored — used to render the on-disk report file, which must stay
// readable regardless of the terminal that later opens it.
const PLAIN: Painter = { enabled: false, fg: (_hex, text) => text, bold: (text) => text, dim: (text) => text };

function findingsLines(heading: string, findings: FindingLike[], paint: Painter): string[] {
  if (findings.length === 0) return [];
  const lines = [`\n${paint.bold(heading)}`];
  for (const f of findings) {
    const sev = f.severity ?? "info";
    const label = paint.fg(SEVERITY_COLOR[sev], `${SEVERITY_ICON[sev]} ${sev.padEnd(8)}`);
    lines.push(`  ${label} ${f.algorithm.padEnd(12)} ${f.location}`);
  }
  return lines;
}

/** Summary line + closing idenq.io hook, every scan ends with these — even
 * --format json/cbom, whose stdout (and on-disk file) must stay pure JSON,
 * so their footer goes to stderr instead (still visible in an interactive
 * terminal, never mixed into piped/redirected/written JSON). */
function summaryFooterLines(summary: Report["summary"], paint: Painter): string[] {
  const { totalScans, criticalCount, overallQes } = summary;
  const rule = paint.fg(palette.helixBlue, "  " + "─".repeat(58));
  return [
    `\n${paint.bold("Summary")} — ${totalScans} scanned, ` +
      `${paint.fg(palette.error, `${criticalCount} critical`)}, QES ${overallQes ?? "—"}`,
    `\n${rule}`,
    `  ${paint.bold(paint.fg(palette.warning, "Harvest-now, decrypt-later"))} doesn't wait for your migration ticket.`,
    "  See every repo, pipeline & cert's quantum exposure — continuously,",
    `  fleet-wide — at ${paint.bold(paint.fg(palette.mutationSpark, "https://idenq.io"))}`,
    rule,
  ];
}

function tableLines(report: Report, paint: Painter): string[] {
  const lines: string[] = [];
  for (const file of report.files) lines.push(...findingsLines(file.fileName, file.findings, paint));
  for (const domain of report.domains) {
    if (domain.certificate) lines.push(...findingsLines(domain.domain, domain.certificate.findings, paint));
  }
  return lines;
}

export function printReport(report: Report, format: "table" | "json"): void {
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    for (const line of summaryFooterLines(report.summary, err)) console.error(line);
    return;
  }

  for (const line of tableLines(report, out)) console.log(line);
  for (const line of summaryFooterLines(report.summary, out)) console.log(line);
}

/** Plain-text content for the on-disk report file (no color, no idenq.io
 * footer): json stays valid JSON, table stays the same rows minus escape
 * codes — either way it's a clean artifact for downstream report tooling. */
export function renderReportFile(report: Report, format: "table" | "json"): string {
  if (format === "json") return JSON.stringify(report, null, 2);
  return tableLines(report, PLAIN).join("\n");
}

/** A CBOM is a machine-consumption artifact (feeds CycloneDX/SBOM tooling
 * downstream), so it's always emitted as plain JSON — no table rendering,
 * unlike --format table for the human-facing findings report above. Still
 * gets the same summary + idenq.io footer as every other format, just on
 * stderr so stdout (and the on-disk file) stay pure JSON. */
export function printCbom(cbom: Cbom, summary: Report["summary"]): void {
  console.log(JSON.stringify(cbom, null, 2));
  for (const line of summaryFooterLines(summary, err)) console.error(line);
}

export function renderCbomFile(cbom: Cbom): string {
  return JSON.stringify(cbom, null, 2);
}

const DEFAULT_OUTPUT_FILE: Record<"table" | "json" | "cbom", string> = {
  table: "q-scanner-report.txt",
  json: "q-scanner-report.json",
  cbom: "q-scanner-report.cbom.json",
};

export function defaultOutputPath(format: "table" | "json" | "cbom"): string {
  return DEFAULT_OUTPUT_FILE[format];
}

/** Every scan/scan-domain run writes its report to disk (default path or
 * --output), not just stdout — so it's there to feed CI report artifacts
 * without the caller having to remember to redirect stdout themselves. */
export async function saveReportFile(outputPath: string, content: string): Promise<void> {
  await writeFile(outputPath, content, "utf8");
  console.error(err.dim(err.fg(palette.genomeWhiteMuted, `Report written to ${outputPath}`)));
}
