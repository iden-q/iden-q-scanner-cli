import { test } from "node:test";
import assert from "node:assert/strict";
import { printReport, printCbom, renderReportFile, renderCbomFile, defaultOutputPath } from "./output.js";
import type { Cbom } from "@iden-q/scanner-lib";

function captureLog(fn: () => void): string[] {
  const original = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

function captureError(fn: () => void): string[] {
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return lines;
}

const sampleReport = {
  summary: { totalScans: 3, criticalCount: 1, overallQes: 42 },
  files: [
    {
      fileName: "id_rsa",
      findings: [
        { algorithm: "RSA", severity: "critical" as const, location: "PEM: RSA PRIVATE KEY" },
      ],
    },
    { fileName: "empty.txt", findings: [] },
  ],
  domains: [
    {
      domain: "example.com",
      certificate: {
        findings: [{ algorithm: "ECDSA", severity: "high" as const, location: "TLS certificate" }],
      },
    },
    { domain: "unreachable.example", certificate: null },
  ],
};

test("printReport json format emits exactly one console.log call containing valid JSON matching the report", () => {
  const lines = captureLog(() => printReport(sampleReport, "json"));

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.deepEqual(parsed, sampleReport);
});

test("printReport table format prints severity, algorithm and location for each finding", () => {
  const lines = captureLog(() => printReport(sampleReport, "table"));
  const output = lines.join("\n");

  assert.match(output, /critical/);
  assert.match(output, /RSA/);
  assert.match(output, /PEM: RSA PRIVATE KEY/);
  assert.match(output, /high/);
  assert.match(output, /ECDSA/);
  assert.match(output, /TLS certificate/);
});

test("printReport table format skips files/domains with no findings", () => {
  const lines = captureLog(() => printReport(sampleReport, "table"));
  const output = lines.join("\n");

  assert.doesNotMatch(output, /empty\.txt/);
  assert.doesNotMatch(output, /unreachable\.example/);
});

test("printReport table format includes the summary line", () => {
  const lines = captureLog(() => printReport(sampleReport, "table"));
  const output = lines.join("\n");

  assert.match(output, /Summary/);
  assert.match(output, /3 scanned/);
  assert.match(output, /1 critical/);
  assert.match(output, /QES 42/);
});

const sampleCbom: Cbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.6",
  metadata: { timestamp: "2026-01-01T00:00:00.000Z", tool: "QuantumScanner" },
  summary: { totalAssets: 0, quantumSafeCount: 0, quantumVulnerableCount: 0, fipsCoverage: {} },
  components: [],
};

test("printCbom emits exactly one console.log call containing the CBOM as valid JSON", () => {
  const lines = captureLog(() => printCbom(sampleCbom, sampleReport.summary));

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.deepEqual(parsed, sampleCbom);
});

test("printCbom prints the summary + idenq.io footer to stderr, keeping stdout pure JSON", () => {
  const errLines = captureError(() => printCbom(sampleCbom, sampleReport.summary));
  const output = errLines.join("\n");

  assert.match(output, /Summary/);
  assert.match(output, /3 scanned/);
  assert.match(output, /idenq\.io/);
});

test("renderCbomFile returns the CBOM as plain JSON, no footer", () => {
  const content = renderCbomFile(sampleCbom);

  assert.deepEqual(JSON.parse(content), sampleCbom);
  assert.doesNotMatch(content, /idenq\.io/);
});

test("renderReportFile json format returns plain JSON matching the report, no footer", () => {
  const content = renderReportFile(sampleReport, "json");

  assert.deepEqual(JSON.parse(content), sampleReport);
  assert.doesNotMatch(content, /idenq\.io/);
});

test("renderReportFile table format has no ANSI color codes", () => {
  const content = renderReportFile(sampleReport, "table");

  assert.match(content, /RSA/);
  assert.doesNotMatch(content, /\x1b\[/);
});

test("defaultOutputPath names the file after the format", () => {
  assert.equal(defaultOutputPath("table"), "q-scanner-report.txt");
  assert.equal(defaultOutputPath("json"), "q-scanner-report.json");
  assert.equal(defaultOutputPath("cbom"), "q-scanner-report.cbom.json");
});

test("printReport table format falls back to 'info' severity and '—' QES when missing", () => {
  const report = {
    summary: { totalScans: 1, criticalCount: 0, overallQes: null },
    files: [{ fileName: "notes.txt", findings: [{ algorithm: "MD5", location: "source pattern" }] }],
    domains: [],
  };
  const lines = captureLog(() => printReport(report, "table"));
  const output = lines.join("\n");

  assert.match(output, /info/);
  assert.match(output, /QES —/);
});
