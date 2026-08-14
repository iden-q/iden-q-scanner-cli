# Open fronts — `@iden-q/scanner-cli`

A snapshot of what is open, read from the code against `edc39ec` (v0.4.0) on
2026-08-10. The repo is in good shape: no `TODO`/`FIXME`/`HACK` markers, no
`.skip`/`.todo` tests, no pending changesets, `CHANGELOG.md` top (0.4.0) matches
`package.json`, and the `@iden-q/scanner-lib` pin `^0.2.0` resolves to 0.2.0 in
`yarn.lock` — current, not stale. The items below are mostly latent gaps and CI
robustness, not broken features. (Detection coverage itself lives in
`@iden-q/scanner-lib`; its open fronts are documented there and flow through here.)

## High

- **The device-flow approve→token step has no automated coverage, structurally.**
  `q-scanner login` (RFC 8628) is well unit-tested up to the network edge — the poll
  state machine (`authorization_pending`/`slow_down`/`access_denied`/`expired_token`,
  local expiry) in `src/auth/device-flow.test.ts`, the 0600 session store, token
  decode/refresh, the read-modify-write history merge, and offline command behaviour.
  What no test drives is the full ceremony end to end: approval requires a person to
  sign in and step up with a passkey in the console, so the final mint cannot be
  automated from here. It was smoke-verified by hand against dev (the request + poll
  loop reach the deployed flow, which answers the RFC shape); the same limit means
  live `--save`/`history` need a real login. This is inherent to the flow, not a
  deferred test — noted so it is not mistaken for full coverage.

- **An invalid `--format` silently degrades to `table` instead of erroring.**
  `src/commands/scan.ts:71` (and identically `src/commands/scan-domain.ts`):
  `values.format === "cbom" ? "cbom" : values.format === "json" ? "json" : "table"`.
  `q-scanner scan . --format xml` produces a table with no warning and exit 0.
  Unlike `--lang` and `--fail-on`, `--format` has no validation path, so a CI or
  report pipeline expecting JSON/CBOM is silently handed a table.
- **`scan-domain` has no execution test at all.** `src/cli.integration.test.ts`
  references `scan-domain` only inside the `--help` output assertion. The whole
  domain path — the connection-failure exit branch, `--fail-on` on a certificate
  severity, and CBOM/JSON for domains — is unverified. `probeDomain` needs network
  so it was skipped, but the failure/exit-code contract is entirely untested.

## Medium

- **`--fail-on` and `--format` are validated only after a full scan + file write.**
  `applyFailOn` validates the value in `src/severity-gate.ts`, called last in
  `scan.ts` / `scan-domain.ts`. A typo like `--fail-on hihg` scans the entire tree,
  writes `q-scanner-report.*`, prints the report, and only then throws — wasted work
  and a confusing late error for the core CI use case.
- **`scan-domain` writes a report file and prints the report even when the probe
  fails.** `src/commands/scan-domain.ts` calls `saveReportFile` and prints the
  report + footer before the `!result.connected` check, so a failed domain still
  emits "Report written to…" plus a near-empty report, then the error — noisy and
  potentially misleading in CI artifacts.
- **`engines: >=20` is never exercised on Node 20.** `package.json:9` claims
  `node >=20`, but `.nvmrc` pins `v24.8.0` and both CI and CD use
  `node-version-file: .nvmrc`. There is no test matrix, so the advertised Node-20
  floor is asserted but only run on Node 24.
- **Integration tests silently no-op without a prior `yarn build`.** Every test in
  `src/cli.integration.test.ts` does `if (!existsSync(distIndex)) return t.skip(...)`.
  Running `yarn test` alone (no build) skips the entire E2E suite and still reports
  green — a coverage cliff if a step reorders build/test or someone runs tests
  locally.

## Low

- **`verify:no-sourcemaps` guards leakage, not obfuscation.**
  `scripts/verify-no-sourcemaps.mjs` only checks that no `.map` file is in the
  tarball; it does not verify `dist/index.js` is actually obfuscated. A silently
  no-op obfuscation (the stated anti-copying goal, `scripts/obfuscate.mjs`) would
  ship readable source and still pass `prepublishOnly` — there is no positive
  assertion anywhere.
- **CBOM `metadata.tool` is a generic string, not the CLI name/version.** The CBOM
  shape uses `tool: "QuantumScanner"` with no version/vendor. For a CycloneDX
  artifact meant to feed SBOM tooling, the producing tool + version is normally
  expected. (Generated in the lib, surfaced as a CLI deliverable.)
- **Untested branches in `scan`.** The unreadable-file skip, the binary-cert branch
  (`isBinaryCert` for `.der/.p12/.pfx/.pdf`), and the directory-walk (non-stdin)
  path have no integration coverage; only `--stdin` is exercised end-to-end.
  `fs-walk.test.ts` unit-tests `walk`/`isBinaryCert` but not the
  `scanBinaryForCrypto` wiring.
- **Empty release pipeline.** `README.md` and `CHANGELOG.md` carry no
  "planned"/"not yet"/"limitation" language and `.changeset/` holds no pending
  changeset: nothing blocks a release, but nothing is staged for the next one.
- **Duplicated format-resolution + report-write logic** across `scan.ts` and
  `scan-domain.ts` — not a bug, but the invalid-format and write-before-check items
  above exist in two places and must be fixed in both.

## Where the leverage is

Two small, high-value fixes: validate `--format`/`--fail-on` up front (before the
scan and the file write, in the one shared place both commands would call), and
give `scan-domain` an execution test covering the connection-failure exit code —
that path is the CI contract and it is currently unverified.
