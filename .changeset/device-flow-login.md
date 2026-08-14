---
"@iden-q/scanner-cli": minor
---

Add device-flow login and cloud scan history — a person can now sign in and save scans to their iden-q account.

New commands: `q-scanner login` runs the OAuth 2.0 device authorization flow (RFC 8628) — it prints a URL and a short code, the person approves it in the console (with the mandatory passkey step-up), and the CLI stores the resulting **person** token (access + refresh) under `~/.config/q-scanner/session.json` at mode `0600`. The CLI never holds a static secret, only short-lived tokens, and the access token is refreshed automatically within the twelve-hour window. `logout` revokes and forgets the session; `whoami` shows the signed-in account, roles, and environment; `history` lists the cloud scan history (`--clear` deletes it).

New `--save` on `scan` and `scan-domain` pushes the scan into the user's cloud history at `/quantum/scans` — the **same** per-user snapshot the web scanner reads, appended read-modify-write so a CLI scan shows up in the web dashboard and neither surface clobbers the other. It is off the scan's critical path (a save failure is a warning, never a change to findings or exit code) and requires a login.

The platform API base is `--api-url` / `IDENQ_API_URL`, defaulting to prod. This person axis is independent of the anonymous machine telemetry (`--connect-mesh`): they can be used separately or together.
