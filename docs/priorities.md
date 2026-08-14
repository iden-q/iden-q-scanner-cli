# Priorities — `@iden-q/scanner-cli`

**What this is:** an actionable ranking, not a catalogue. The full catalogue lives in
[`open-fronts.md`](open-fronts.md). Snapshot against `edc39ec` (v0.4.0) on 2026-08-10.

**Context:** the CLI is in good shape — no TODO/FIXME, no skipped tests, changelog and
`package.json` in sync, `@iden-q/scanner-lib` pin `^0.2.0` current. Detection *coverage*
is not this repo's problem; it lives in `@iden-q/scanner-lib` (see its `priorities.md`)
and flows through here. What is open is CLI contract robustness and test coverage of the
paths CI depends on.

## P0 — CLI contract holes that bite CI silently

1. **Invalid `--format` silently degrades to `table`** (`src/commands/scan.ts:71`,
   same in `scan-domain.ts`): `--format xml` prints a table with exit 0. A pipeline
   expecting JSON/CBOM is handed a table with no error. Unlike `--lang`/`--fail-on`,
   `--format` has no validation path.
2. **`scan-domain` has no execution test** (`src/cli.integration.test.ts` references it
   only in the `--help` assertion). The connection-failure exit branch, `--fail-on` on a
   certificate severity, and CBOM/JSON for domains are all unverified — and that exit
   code is the CI contract.

## P1 — validation timing and test cliffs

3. **`--fail-on` / `--format` validated only after a full scan + file write**
   (`applyFailOn` in `src/severity-gate.ts`, called last). A typo scans the whole tree,
   writes the report, prints it, then throws — wasted work and a confusing late error.
   Fix both flags up front, in the one shared place both commands call.
4. **`scan-domain` writes and prints even when the probe fails** — `saveReportFile` +
   report print happen before the `!result.connected` check, so a failed domain emits
   "Report written to…" and a near-empty report, then the error. Noisy/misleading in CI.
5. **Integration tests silently no-op without a prior `yarn build`** (every test
   `return t.skip(...)` if `dist/` is absent). `yarn test` alone skips the whole E2E
   suite and still reports green — a coverage cliff.
6. **`engines: >=20` never exercised on Node 20** (`package.json:9` vs `.nvmrc` `v24.8.0`;
   CI uses the `.nvmrc`). The advertised floor is asserted but only run on Node 24.

## P2 — hardening / hygiene

7. **`verify:no-sourcemaps` guards leakage, not obfuscation** — a silently no-op
   obfuscation would ship readable source and still pass `prepublishOnly`. No positive
   assertion that `dist/index.js` is actually obfuscated.
8. **CBOM `metadata.tool` is a generic string**, not the CLI name/version — for a
   CycloneDX artifact meant to feed SBOM tooling, tool+version is normally expected.
9. **Untested branches in `scan`** (unreadable-file skip, binary-cert branch, directory
   walk) — only `--stdin` is exercised end-to-end.
10. **Duplicated format-resolution + report-write logic** across `scan.ts` and
    `scan-domain.ts` — the P0/P1 fixes above must land in both; a shared helper removes
    the double-maintenance.

## Cross-repo dependencies

- **Consumes** `@iden-q/scanner-lib`; all detection gaps are inherited from there — no
  detection work belongs in this repo.
- **Optionally reaches the mesh** via `--connect-mesh` (`src/mesh-emit.ts`), which uses
  `@iden-q/scanner-lib`'s `createMeshClient` + `emitObservations` to emit anonymous CBOM
  telemetry to `tx-platform`'s ingest endpoint. It is opt-in, off the scan's critical path
  (never affects findings or exit code), and standalone by default — so the CLI stays
  independently actionable, but it is no longer a pure offline client. Both mesh credential
  modes are carried: an API key (`client_credentials`, inline or env) and a public-key
  credential (`private_key_jwt` — an ML-DSA-44 private JWK in `IDENQ_MESH_PRIVATE_KEY`,
  env-only, signed locally with `@iden-q/post-quantum`; the private half never leaves the
  process). `buildMeshCredential` derives the signer and is unit-tested against the JWK's
  own verification key.
  **`scan-domain` now emits too — DONE.** On `@iden-q/scanner-lib@^1.3.0`, both commands map
  through the library: `scan` builds one observation per file (`buildObservation`), and
  `scan-domain` builds one per probe (`buildProbeObservation`) — the class from the negotiated
  key-exchange group, the issuer named from its `O`, the same primitive the web scanner uses,
  so both surfaces emit the same graph and the same CA token. (The `1.3.0` bump also replaced
  the removed `observationsFromFindings` with per-source `buildObservation`.) Still open: no
  execution test exercises the live emit path (the `resolveMeshEmit` resolver and
  `buildMeshCredential` are unit-tested, and the mapping's vectors live in the library; the
  network round-trip is not exercised here).

## Where to start

Two small, high-value fixes: validate `--format`/`--fail-on` up front in the one shared
place both commands call, and give `scan-domain` an execution test covering the
connection-failure exit code — the CI contract that is currently unverified.
