import type { Severity } from "@iden-q/scanner-lib";
import { palette, out, err, type Painter, SEVERITY_COLOR, SEVERITY_ICON } from "./theme.js";

interface FindingLike {
  algorithm: string;
  severity?: Severity;
  location: string;
}

interface Report {
  summary: { totalScans: number; criticalCount: number; overallQes: number | null };
  files: Array<{ fileName: string; findings: FindingLike[] }>;
  domains: Array<{ domain: string; certificate: { findings: FindingLike[] } | null }>;
}

function printFindings(heading: string, findings: FindingLike[]): void {
  if (findings.length === 0) return;
  console.log(`\n${out.bold(heading)}`);
  for (const f of findings) {
    const sev = f.severity ?? "info";
    const label = out.fg(SEVERITY_COLOR[sev], `${SEVERITY_ICON[sev]} ${sev.padEnd(8)}`);
    console.log(`  ${label} ${f.algorithm.padEnd(12)} ${f.location}`);
  }
}

/** Summary line + closing idenq.io hook, every scan ends with these — even
 * --format json, whose stdout must stay pure JSON, so its footer goes to
 * stderr instead of stdout (still visible in an interactive terminal, never
 * mixed into piped/redirected JSON). */
function summaryFooterLines(report: Report, paint: Painter): string[] {
  const { totalScans, criticalCount, overallQes } = report.summary;
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

export function printReport(report: Report, format: "table" | "json"): void {
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    for (const line of summaryFooterLines(report, err)) console.error(line);
    return;
  }

  for (const file of report.files) printFindings(file.fileName, file.findings);
  for (const domain of report.domains) {
    if (domain.certificate) printFindings(domain.domain, domain.certificate.findings);
  }
  for (const line of summaryFooterLines(report, out)) console.log(line);
}
