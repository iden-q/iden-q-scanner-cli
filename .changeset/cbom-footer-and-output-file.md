---
"@iden-q/scanner-cli": minor
---

`--format cbom` now prints the same summary + idenq.io closing footer as `table`/`json` (previously silent) — still routed to stderr so stdout and the on-disk file stay pure JSON.

Every `scan`/`scan-domain` run now writes its report to disk in the requested `--format`, not just stdout: to `./q-scanner-report.<txt|json|cbom.json>` by default, or to `--output <path>` when given — so a report file is always there to pick up in CI/report tooling without remembering to redirect stdout yourself.
