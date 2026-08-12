---
"@iden-q/scanner-cli": patch
---

Ship the honest-detector upgrade to CLI users: the bundled `@iden-q/scanner-lib` moves to 0.2.2, adding Taproot/bech32m address detection, EdDSA + modern signature/key-agreement OIDs, safe symmetric/hash coverage, post-quantum family + hybrid key-establishment detection, per-match findings with line numbers, and Ethereum EIP-55 checksum validation. All patch-level, no CLI API change.
