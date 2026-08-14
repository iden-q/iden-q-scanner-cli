# @iden-q/scanner-cli

## 0.7.0

### Minor Changes

- [#15](https://github.com/iden-q/iden-q-scanner-cli/pull/15) [`5b5d849`](https://github.com/iden-q/iden-q-scanner-cli/commit/5b5d8498be09d4d280b89d12f9c89664dd484333) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Add device-flow login and cloud scan history — a person can now sign in and save scans to their iden-q account.

  New commands: `q-scanner login` runs the OAuth 2.0 device authorization flow (RFC 8628) — it prints a URL and a short code, the person approves it in the console (with the mandatory passkey step-up), and the CLI stores the resulting **person** token (access + refresh) under `~/.config/q-scanner/session.json` at mode `0600`. The CLI never holds a static secret, only short-lived tokens, and the access token is refreshed automatically within the twelve-hour window. `logout` revokes and forgets the session; `whoami` shows the signed-in account, roles, and environment; `history` lists the cloud scan history (`--clear` deletes it).

  New `--save` on `scan` and `scan-domain` pushes the scan into the user's cloud history at `/quantum/scans` — the **same** per-user snapshot the web scanner reads, appended read-modify-write so a CLI scan shows up in the web dashboard and neither surface clobbers the other. It is off the scan's critical path (a save failure is a warning, never a change to findings or exit code) and requires a login.

  The platform API base is `--api-url` / `IDENQ_API_URL`, defaulting to prod. This person axis is independent of the anonymous machine telemetry (`--connect-mesh`): they can be used separately or together.

- [#13](https://github.com/iden-q/iden-q-scanner-cli/pull/13) [`af66773`](https://github.com/iden-q/iden-q-scanner-cli/commit/af66773897cc018d2179c011e42fe51fecc99d9a) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - `scan-domain` now emits to the mesh under `--connect-mesh`, and both commands map through `@iden-q/scanner-lib@^1.3.0`.

  Previously only `scan` (file/folder) emitted. A `scan-domain` now contributes one observation per probe, built by the library's `buildProbeObservation`: the key-establishment class comes from the negotiated TLS key-exchange group (never the certificate key), and the certificate issuer is named from its organisation (`O`) — the exact same primitive the web scanner uses, so the CLI and the browser emit the same graph and the same issuer token for the same CA. The `scan` path was moved off the removed `observationsFromFindings` onto per-file `buildObservation`, preserving one observation per source. `--connect-mesh` / `--mesh-key` / `--mesh-url` are accepted on `scan-domain` exactly as on `scan`; emission stays off the scan's critical path and never affects findings or exit code.

## 0.6.0

### Minor Changes

- [#11](https://github.com/iden-q/iden-q-scanner-cli/pull/11) [`cffbbf2`](https://github.com/iden-q/iden-q-scanner-cli/commit/cffbbf2d4bf51850e259c2cb592f6e13df13404e) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Support public-key (`private_key_jwt`) mesh credentials alongside the API key.

  `--connect-mesh` now accepts either credential the mesh takes. The API-key path
  is unchanged (`--mesh-key clientId:apiKey`, or `IDENQ_MESH_CLIENT_ID` +
  `IDENQ_MESH_API_KEY`). New: a public-key credential — the ML-DSA-44 private JWK
  the console mints — supplied as `IDENQ_MESH_PRIVATE_KEY` (the JWK JSON) with
  `IDENQ_MESH_CLIENT_ID`. The CLI derives the signing key with
  `@iden-q/post-quantum` and signs a short-lived assertion per token; the private
  half never leaves the process and no shared secret is sent. It is environment-only
  (a private key is a secret, never in argv). When both are configured, the private
  JWK is preferred over the API key.

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
