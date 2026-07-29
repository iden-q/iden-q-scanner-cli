<p align="center">
  <img src="./assets/banner.png" alt="IdenQ Scanner CLI" width="100%" />
</p>

# @iden-q/scanner-cli

Command-line post-quantum cryptography exposure scanner, for DevOps, platform, and security engineers who need to know what crypto is quietly shipping to prod. Point it at a file, a folder, piped stdin (e.g. a `git diff`), or a live domain's TLS certificate, and it reports crypto that's vulnerable to quantum attack. Built for CI pipelines (via `--fail-on`) as well as local dev use.

## Install

Global install:

```bash
npm install -g @iden-q/scanner-cli
q-scanner scan .
```

No-install, via npx (the package's bin is `q-scanner`, not the package name):

```bash
npx -p @iden-q/scanner-cli q-scanner scan .
```

## Usage

```
q-scanner — post-quantum cryptography exposure scanner

Usage:
  q-scanner scan <path>          Scan a file or folder for vulnerable crypto
  q-scanner scan --stdin         Scan piped text (e.g. git diff | q-scanner scan --stdin)
  q-scanner scan-domain <host>   Scan a domain's TLS certificate

Options:
  --format <table|json>          Output format (default: table)
  --fail-on <critical|high|medium|low>
                                  Exit 1 if the worst finding meets/exceeds this severity
  -h, --help                     Show this help
```

Output is in English only. Colored, animated output is used automatically on an interactive terminal (respects `NO_COLOR`); it's plain text — and quiet, no spinner frames — when piped or run in CI.

<p align="center">
  <img src="./assets/terminal.png" alt="q-scanner scan ./src — colored terminal output" width="720" />
</p>

### Examples

Scan a folder and print a table:

```bash
q-scanner scan ./src
```

Scan a domain's TLS certificate as JSON:

```bash
q-scanner scan-domain example.com --format json
```

Gate a CI step on findings — fail the build if a diff introduces anything high severity or worse:

```bash
git diff origin/main...HEAD | q-scanner scan --stdin --fail-on high
```

## A note on the published build

The `dist/` shipped to npm is obfuscated (via `javascript-obfuscator`) as an anti-copying deterrent. It doesn't change behavior — same inputs, same outputs, same exit codes. If you're debugging the CLI itself, build from source instead (see Developing).

## Library

The detection logic lives in [`@iden-q/scanner-lib`](https://github.com/iden-q/iden-q-scanner-lib), a standalone package this CLI is built on. Use it directly if you want to embed the same scanning in your own tool instead of shelling out to `q-scanner`.

## Developing

```bash
yarn install
yarn build
yarn test
yarn typecheck
```

## Releasing

Versioning and publishing are automatic, via [Changesets](https://github.com/changesets/changesets). If your change should ship in the next release, add a changeset before opening a PR:

```bash
yarn changeset
```

Follow the prompt (bump type + a short summary — this becomes the changelog entry). Merging your PR into `main` makes the CD workflow open or update a "Version Packages" PR that bumps `package.json` and `CHANGELOG.md`. Merging *that* PR publishes to npm automatically. No manual version bumps, no manual `npm publish`.

## License

AGPL-3.0-or-later — see [LICENSE](./LICENSE). If you modify this CLI and distribute it (including running it as a network service), you must make your modified source available under the same license.
