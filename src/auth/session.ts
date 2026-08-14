import { readSession, writeSession, type StoredSession } from "./session-store.js";
import { decodeToken, isExpired, refreshAccessToken, type TokenClaims } from "./token.js";
import { ApiError } from "./http.js";

// Turning a persisted session into a usable one: read it, and if the access token
// has expired (or is about to), refresh it against the SAME environment it was
// minted for and persist the rotated pair — so a command run hours after `login`
// (within the twelve-hour refresh window) just works, and one run past it fails
// cleanly with "log in again" rather than a raw 401.

/** No usable session — the caller should tell the user to run `q-scanner login`. */
export class NotLoggedInError extends Error {
  constructor(message = "Not logged in. Run `q-scanner login` first.") {
    super(message);
    this.name = "NotLoggedInError";
  }
}

/** A session ready to make authenticated calls. */
export interface ActiveSession {
  apiUrl: string;
  accessToken: string;
  claims: TokenClaims | null;
}

/** Load the session and guarantee a live access token, refreshing (and
 * persisting the rotation) when it has expired. Throws `NotLoggedInError` when
 * there is no session or the refresh token is spent — both mean "log in again". */
export async function requireSession(
  env: NodeJS.ProcessEnv = process.env,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<ActiveSession> {
  const stored = await readSession(env);
  if (!stored) throw new NotLoggedInError();

  if (!isExpired(stored.accessToken, nowSeconds)) {
    return { apiUrl: stored.apiUrl, accessToken: stored.accessToken, claims: decodeToken(stored.accessToken) };
  }

  try {
    const refreshed = await refreshAccessToken(stored.apiUrl, stored.refreshToken);
    const updated: StoredSession = {
      apiUrl: stored.apiUrl,
      accessToken: refreshed.accessToken,
      // Body-transport rotation returns a new refresh token; a grace refresh omits
      // it, in which case the one we hold is still valid — keep it.
      refreshToken: refreshed.refreshToken ?? stored.refreshToken,
      obtainedAt: Date.now(),
    };
    await writeSession(updated, env);
    return { apiUrl: updated.apiUrl, accessToken: updated.accessToken, claims: decodeToken(updated.accessToken) };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new NotLoggedInError("Your session expired. Run `q-scanner login` again.");
    }
    throw error;
  }
}
