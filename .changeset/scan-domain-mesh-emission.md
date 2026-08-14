---
"@iden-q/scanner-cli": minor
---

`scan-domain` now emits to the mesh under `--connect-mesh`, and both commands map through `@iden-q/scanner-lib@^1.3.0`.

Previously only `scan` (file/folder) emitted. A `scan-domain` now contributes one observation per probe, built by the library's `buildProbeObservation`: the key-establishment class comes from the negotiated TLS key-exchange group (never the certificate key), and the certificate issuer is named from its organisation (`O`) — the exact same primitive the web scanner uses, so the CLI and the browser emit the same graph and the same issuer token for the same CA. The `scan` path was moved off the removed `observationsFromFindings` onto per-file `buildObservation`, preserving one observation per source. `--connect-mesh` / `--mesh-key` / `--mesh-url` are accepted on `scan-domain` exactly as on `scan`; emission stays off the scan's critical path and never affects findings or exit code.
