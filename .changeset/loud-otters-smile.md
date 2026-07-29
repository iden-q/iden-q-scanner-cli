---
"@iden-q/scanner-cli": minor
---

Restyled the CLI with the IdenQ dark design system: truecolor severity output (auto-disabled when piped or `NO_COLOR` is set), animated stderr spinners during scans, an ASCII IdenQ logo on `--help`, and a closing call-to-action pointing to idenq.io after every report. Dropped the `--locale` flag — the CLI now always runs in English.
