// The small HTTP surface the person flows need. Two request shapes on purpose:
//   - `postForm` — `application/x-www-form-urlencoded`, for the OAuth endpoints
//     (`/iam/auth/device/code`, `/iam/auth/token`), which is the shape RFC 8628 /
//     6749 specify and the token controller parses first.
//   - `postJson` / `getJson` / `del` — `application/json` with a Bearer token, for
//     the platform's person API (`/iam/auth/refresh`, `/iam/auth/access/*`,
//     `/quantum/scans`), the same shape the web client sends.
// Every error becomes an `ApiError` carrying the HTTP status and, when the body
// is an OAuth error, its `error` code — which is exactly what the device-flow
// poll branches on (`authorization_pending`, `slow_down`, …).

/** An HTTP failure from the platform API. `oauthError` is the RFC error `code`
 * (`authorization_pending`, `access_denied`, …) when the body carried one, so the
 * device-flow poll can decide whether to keep waiting, wait longer, or stop. */
export class ApiError extends Error {
  status: number;
  oauthError?: string;
  constructor(message: string, status: number, oauthError?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.oauthError = oauthError;
  }
}

interface ErrorBody {
  error?: string;
  error_description?: string;
  message?: string;
}

async function toError(res: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    body = null;
  }
  const message =
    body?.error_description ?? body?.message ?? body?.error ?? `Request failed (${res.status})`;
  return new ApiError(message, res.status, body?.error);
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** POST `application/x-www-form-urlencoded` (the OAuth endpoints). No auth header:
 * these carry their credential in the body (or none, for `device/code`). */
export async function postForm(url: string, fields: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(fields).toString(),
  });
  if (!res.ok) throw await toError(res);
  return readJson(res);
}

/** POST `application/json` with an optional Bearer token (the platform person API). */
export async function postJson(url: string, body: unknown, token?: string): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toError(res);
  return readJson(res);
}

/** GET `application/json` with a Bearer token. */
export async function getJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await toError(res);
  return readJson(res);
}

/** DELETE with a Bearer token. */
export async function del(url: string, token: string): Promise<void> {
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await toError(res);
}
