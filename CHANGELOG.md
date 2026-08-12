# @iden-q/scanner-cli

## 0.5.0

### Minor Changes

- [#9](https://github.com/iden-q/iden-q-scanner-cli/pull/9) [`a348542`](https://github.com/iden-q/iden-q-scanner-cli/commit/a3485423c50dd831c5ff6241a0cdf70c398df236) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Add `--connect-mesh` to `q-scanner scan`: opt a CI scan in to emitting anonymous key-establishment telemetry (which fraction of detected key establishment is classical/hybrid/post-quantum) to the iden-q mesh. The scanner stays standalone by default — no network call, fully offline — and emission is off the scan's critical path: it never changes findings, output, or exit code, so `--fail-on` still gates on the scan alone and an unreachable mesh yields at most a stderr warning. The credential is a `client_credentials` API key (`clientId` + secret), inline via `--mesh-key clientId:apiKey` or, preferred in CI so the secret never appears in argv, via `IDENQ_MESH_CLIENT_ID` + `IDENQ_MESH_API_KEY`. The mesh URL is required with no default (`--mesh-url` or `IDENQ_MESH_URL`) so emitting is always a named target. Requires `@iden-q/scanner-lib` ≥ 0.3.0 (the mesh client + emission API). `scan-domain` does not emit yet.

## 0.4.1

### Patch Changes

- [#7](https://github.com/iden-q/iden-q-scanner-cli/pull/7) [`387f79a`](https://github.com/iden-q/iden-q-scanner-cli/commit/387f79abeb723caf7d1ecabc1bee7f658dece7aa) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Ship the honest-detector upgrade to CLI users: the bundled `@iden-q/scanner-lib` moves to 0.2.2, adding Taproot/bech32m address detection, EdDSA + modern signature/key-agreement OIDs, safe symmetric/hash coverage, post-quantum family + hybrid key-establishment detection, per-match findings with line numbers, and Ethereum EIP-55 checksum validation. All patch-level, no CLI API change.

## 0.4.0

### Minor Changes

- [`f4cd748`](https://github.com/iden-q/iden-q-scanner-cli/commit/f4cd748a5fe8fb60281c9e4b68b9052c07092c85) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - `--format cbom` now prints the same summary + idenq.io closing footer as `table`/`json` (previously silent) — still routed to stderr so stdout and the on-disk file stay pure JSON.

  Every `scan`/`scan-domain` run now writes its report to disk in the requested `--format`, not just stdout: to `./q-scanner-report.<txt|json|cbom.json>` by default, or to `--output <path>` when given — so a report file is always there to pick up in CI/report tooling without remembering to redirect stdout yourself.

## 0.3.0

### Minor Changes

- [`a763a9a`](https://github.com/iden-q/iden-q-scanner-cli/commit/a763a9a35c25528d8ac7f3ae3faeb17ba103f493) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Re-added multilingual output via a new `--lang <en|es>` flag (default `en`), reversing the earlier "always English" decision — `q-scanner scan ./src --lang es` now localizes finding locations, error messages, and regulatory notes to Spanish, same as the underlying library.

  Added `--format cbom`, which emits a CycloneDX-shaped Cryptography Bill of Materials instead of the findings report — one row per distinct algorithm found, tagged with its NIST FIPS standard (ML-KEM → FIPS 203, ML-DSA → FIPS 204, SLH-DSA → FIPS 205) and a migration target for quantum-vulnerable algorithms.

  Wallet secret detection (Bitcoin/Ethereum addresses, BIP39 seed phrases, JWTs, and now WIF/BIP32 private keys) already runs as part of `scan`/`scan-domain` via the library's crypto scan — no separate flag needed.

  Requires `@iden-q/scanner-lib` ^0.2.0, which adds the required `locale` parameter these commands now pass through, plus `buildCbom`.

## 0.2.0

### Minor Changes

- [`023dddc`](https://github.com/iden-q/iden-q-scanner-cli/commit/023dddc306212e8fbbcb8a707f84264f63d5ab5e) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Restyled the CLI with the IdenQ dark design system: truecolor severity output (auto-disabled when piped or `NO_COLOR` is set), animated stderr spinners during scans, an ASCII IdenQ logo on `--help`, and a closing call-to-action pointing to idenq.io after every report. Dropped the `--locale` flag — the CLI now always runs in English.
