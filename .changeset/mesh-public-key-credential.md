---
"@iden-q/scanner-cli": minor
---

Support public-key (`private_key_jwt`) mesh credentials alongside the API key.

`--connect-mesh` now accepts either credential the mesh takes. The API-key path
is unchanged (`--mesh-key clientId:apiKey`, or `IDENQ_MESH_CLIENT_ID` +
`IDENQ_MESH_API_KEY`). New: a public-key credential — the ML-DSA-44 private JWK
the console mints — supplied as `IDENQ_MESH_PRIVATE_KEY` (the JWK JSON) with
`IDENQ_MESH_CLIENT_ID`. The CLI derives the signing key with
`@iden-q/post-quantum` and signs a short-lived assertion per token; the private
half never leaves the process and no shared secret is sent. It is environment-only
(a private key is a secret, never in argv). When both are configured, the private
JWK is preferred over the API key.
