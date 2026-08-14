// Reading and refreshing the person access token. The CLI never VERIFIES the
// token — the server does that on every call — it only reads the unverified
// payload to decide whether to refresh and what to show in `whoami`. A tampered
// token buys nothing here: it would at most make the CLI refresh early or print a
// wrong name, and the server re-checks the real grants on every request.

import { ApiError, postJson } from "./http.js";

/** The claims the CLI reads (unverified) from a person access token. */
export interface TokenClaims {
  sub?: string;
  email?: string;
  roles: string[];
  /** Expiry, epoch seconds, if present. */
  exp?: number;
  /** Authentication context class — `aal2` when the approval required a passkey. */
  acr?: string;
}

/** Decode a JWT's payload WITHOUT verifying it, or `null` for anything that is
 * not a well-formed JWT. Never throws. */
export function decodeToken(accessToken: string): TokenClaims | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(json) as Record<string, unknown>;
    const roles = Array.isArray(claims.roles) ? claims.roles.filter((r): r is string => typeof r === "string") : [];
    return {
      sub: typeof claims.sub === "string" ? claims.sub : undefined,
      email: typeof claims.email === "string" ? claims.email : undefined,
      roles,
      exp: typeof claims.exp === "number" ? claims.exp : undefined,
      acr: typeof claims.acr === "string" ? claims.acr : undefined,
    };
  } catch {
    return null;
  }
}

/** Whether an access token is expired (or expires within `skewSeconds`, so a
 * call is refreshed just BEFORE the token dies rather than failing on it). A
 * token with no readable `exp` is treated as expired — safer to refresh a token
 * we cannot reason about than to send one the server will reject. */
export function isExpired(accessToken: string, nowSeconds: number, skewSeconds = 30): boolean {
  const claims = decodeToken(accessToken);
  if (!claims || claims.exp === undefined) return true;
  return claims.exp - skewSeconds <= nowSeconds;
}

/** The result of a refresh: a fresh access token, and a rotated refresh token
 * when the server issued one (body-transport rotation returns a new one; keep the
 * old one when it does not). */
export interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
}

/** Exchange a refresh token for a fresh access token (RFC 6749 refresh grant, the
 * platform's body transport: the refresh token is the credential, in the body).
 * Throws `ApiError` when the refresh is rejected — the caller turns that into
 * "your session expired, run `q-scanner login`". */
export async function refreshAccessToken(apiUrl: string, refreshToken: string): Promise<RefreshResult> {
  const data = (await postJson(`${apiUrl}/iam/auth/refresh`, { refreshToken })) as {
    access_token?: string;
    accessToken?: string;
    refreshToken?: string;
  };
  const accessToken = data.access_token ?? data.accessToken;
  if (!accessToken) throw new ApiError("Refresh returned no access token", 0);
  return { accessToken, refreshToken: data.refreshToken || undefined };
}
