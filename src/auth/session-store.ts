import { mkdir, readFile, writeFile, unlink, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// The person session the device-flow login obtains, persisted between runs so a
// developer logs in once and later `scan --save` / `history` just work. It holds
// SHORT-LIVED tokens only (the whole point of device flow: the CLI never stores a
// static secret) — an access token good for fifteen minutes and a refresh token
// good for twelve hours. Both are still bearer credentials, so the file is
// written 0600 under a 0700 directory: readable only by the user who logged in.

/** A persisted person session. `apiUrl` is stored alongside the tokens because a
 * token minted against dev is meaningless against prod — the pair travels
 * together, so a later command uses the same environment it logged into. */
export interface StoredSession {
  apiUrl: string;
  accessToken: string;
  refreshToken: string;
  /** When the pair was obtained (or last refreshed), epoch ms — informational,
   * for `whoami`. Expiry is read from the access token's own `exp`. */
  obtainedAt: number;
}

/** The config directory the session lives under. `XDG_CONFIG_HOME` if set (the
 * standard override, and what the tests point at a temp dir), else `~/.config`. */
function configDir(env: NodeJS.ProcessEnv): string {
  const base = env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.trim() ? env.XDG_CONFIG_HOME : join(homedir(), ".config");
  return join(base, "q-scanner");
}

/** The absolute path of the session file. */
export function sessionPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "session.json");
}

/** Persist the session, creating the directory 0700 and the file 0600 so no
 * other user on the machine can read the bearer tokens. `chmod` after the write
 * because `writeFile`'s mode only applies when it CREATES the file — an existing
 * file keeps its old mode otherwise, which a re-login must not silently loosen. */
export async function writeSession(session: StoredSession, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const dir = configDir(env);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = sessionPath(env);
  await writeFile(path, JSON.stringify(session, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
}

/** Read the persisted session, or `null` when there is none or it is unreadable
 * (missing file, corrupt JSON, or a shape that is not a session). A corrupt file
 * reads as "not logged in" rather than throwing, so a mangled file is fixed by
 * logging in again, never a crash. */
export async function readSession(env: NodeJS.ProcessEnv = process.env): Promise<StoredSession | null> {
  let raw: string;
  try {
    raw = await readFile(sessionPath(env), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.apiUrl === "string" &&
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string"
    ) {
      return {
        apiUrl: parsed.apiUrl,
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        obtainedAt: typeof parsed.obtainedAt === "number" ? parsed.obtainedAt : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Remove the persisted session. A missing file is success — `logout` when
 * already logged out is not an error. */
export async function clearSession(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  try {
    await unlink(sessionPath(env));
  } catch {
    // Already gone — nothing to clear.
  }
}
