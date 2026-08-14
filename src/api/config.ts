// Where the CLI reaches the iden-q platform API for the person-facing flows
// (device-flow login and cloud scan history). Unlike a browser, the CLI has no
// same-origin `/api/v1`, so it needs an absolute base — and the platform API has
// no host of its own: it is reached through a front end's CloudFront `api/v1/*`
// behaviour (prod `https://idenq.io/api/v1`, dev `https://dev.idenq.io/api/v1`),
// which injects the origin-verify header the API requires. Default to prod; a
// developer targets dev with `--api-url` or `IDENQ_API_URL`.
//
// This is a SEPARATE axis from `--mesh-url`: that is the anonymous machine
// telemetry target (a mesh credential), this is the person API (a person token).
// They are deliberately not the same knob.

const DEFAULT_API_URL = "https://idenq.io/api/v1";

/** Resolve the platform API base URL: an explicit `--api-url` wins, then
 * `IDENQ_API_URL`, then the prod default. The trailing slash is stripped so
 * callers can always join with a leading-slash path. */
export function resolveApiUrl(flag: string | undefined, env: NodeJS.ProcessEnv = process.env): string {
  const raw = flag ?? env.IDENQ_API_URL ?? DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}
