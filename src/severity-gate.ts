import { severityRank, type Severity } from "@iden-q/scanner-lib";

const VALID_SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

/** Sets a non-zero exit code when the worst finding meets or exceeds
 * --fail-on, the CI-gate use case (`q-scanner scan . --fail-on high`). */
export function applyFailOn(worst: Severity | null, failOn: string | undefined): void {
  if (!failOn) return;
  if (!VALID_SEVERITIES.includes(failOn as Severity)) {
    throw new Error(`--fail-on must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }
  if (worst && severityRank(worst) >= severityRank(failOn as Severity)) {
    process.exitCode = 1;
  }
}
