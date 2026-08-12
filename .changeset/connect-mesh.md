---
"@iden-q/scanner-cli": minor
---

Add `--connect-mesh` to `q-scanner scan`: opt a CI scan in to emitting anonymous key-establishment telemetry (which fraction of detected key establishment is classical/hybrid/post-quantum) to the iden-q mesh. The scanner stays standalone by default — no network call, fully offline — and emission is off the scan's critical path: it never changes findings, output, or exit code, so `--fail-on` still gates on the scan alone and an unreachable mesh yields at most a stderr warning. The credential is a `client_credentials` API key (`clientId` + secret), inline via `--mesh-key clientId:apiKey` or, preferred in CI so the secret never appears in argv, via `IDENQ_MESH_CLIENT_ID` + `IDENQ_MESH_API_KEY`. The mesh URL is required with no default (`--mesh-url` or `IDENQ_MESH_URL`) so emitting is always a named target. Requires `@iden-q/scanner-lib` ≥ 0.3.0 (the mesh client + emission API). `scan-domain` does not emit yet.
