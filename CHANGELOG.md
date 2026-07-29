# @iden-q/scanner-cli

## 0.3.0

### Minor Changes

- [`a763a9a`](https://github.com/iden-q/iden-q-scanner-cli/commit/a763a9a35c25528d8ac7f3ae3faeb17ba103f493) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Re-added multilingual output via a new `--lang <en|es>` flag (default `en`), reversing the earlier "always English" decision — `q-scanner scan ./src --lang es` now localizes finding locations, error messages, and regulatory notes to Spanish, same as the underlying library.

  Added `--format cbom`, which emits a CycloneDX-shaped Cryptography Bill of Materials instead of the findings report — one row per distinct algorithm found, tagged with its NIST FIPS standard (ML-KEM → FIPS 203, ML-DSA → FIPS 204, SLH-DSA → FIPS 205) and a migration target for quantum-vulnerable algorithms.

  Wallet secret detection (Bitcoin/Ethereum addresses, BIP39 seed phrases, JWTs, and now WIF/BIP32 private keys) already runs as part of `scan`/`scan-domain` via the library's crypto scan — no separate flag needed.

  Requires `@iden-q/scanner-lib` ^0.2.0, which adds the required `locale` parameter these commands now pass through, plus `buildCbom`.

## 0.2.0

### Minor Changes

- [`023dddc`](https://github.com/iden-q/iden-q-scanner-cli/commit/023dddc306212e8fbbcb8a707f84264f63d5ab5e) Thanks [@cesarmoralesonya](https://github.com/cesarmoralesonya)! - Restyled the CLI with the IdenQ dark design system: truecolor severity output (auto-disabled when piped or `NO_COLOR` is set), animated stderr spinners during scans, an ASCII IdenQ logo on `--help`, and a closing call-to-action pointing to idenq.io after every report. Dropped the `--locale` flag — the CLI now always runs in English.
