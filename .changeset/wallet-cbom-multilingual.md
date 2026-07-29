---
"@iden-q/scanner-cli": minor
---

Re-added multilingual output via a new `--lang <en|es>` flag (default `en`), reversing the earlier "always English" decision — `q-scanner scan ./src --lang es` now localizes finding locations, error messages, and regulatory notes to Spanish, same as the underlying library.

Added `--format cbom`, which emits a CycloneDX-shaped Cryptography Bill of Materials instead of the findings report — one row per distinct algorithm found, tagged with its NIST FIPS standard (ML-KEM → FIPS 203, ML-DSA → FIPS 204, SLH-DSA → FIPS 205) and a migration target for quantum-vulnerable algorithms.

Wallet secret detection (Bitcoin/Ethereum addresses, BIP39 seed phrases, JWTs, and now WIF/BIP32 private keys) already runs as part of `scan`/`scan-domain` via the library's crypto scan — no separate flag needed.

Requires `@iden-q/scanner-lib` ^0.2.0, which adds the required `locale` parameter these commands now pass through, plus `buildCbom`.
