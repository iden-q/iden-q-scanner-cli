// The RFC 8628 device authorization CLIENT — the CLI half of the ceremony whose
// server half lives in iden-q-tx-platform. Two moves:
//   1. `requestDeviceCode` — POST /iam/auth/device/code, get a `device_code` the
//      CLI holds and a short `user_code` a person types into the console.
//   2. `pollForToken` — POST /iam/auth/token with `grant_type=device_code` on the
//      `interval`, reading RFC 8628's "not yet" errors until a person approves in
//      the console (with the mandatory passkey step-up), then the person token.
// The token this yields is the APPROVER'S person token — their identity, their
// roles, `acr=aal2` because a passkey was used at approval — not a machine token.
// The mesh path (client_credentials) is a different axis and untouched by this.

import { ApiError, postForm } from "./http.js";

/** The URN grant type a device-flow poll uses (RFC 8628 §3.4) — the full URN, as
 * the token endpoint requires. */
const GRANT_DEVICE_CODE = "urn:ietf:params:oauth:grant-type:device_code";

/** RFC 8628 §3.2 device-code response. */
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

/** RFC 6749 §5.1 token response (the person token pair). */
export interface DeviceTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/** Why a device flow ended without a token — the two terminal "not this time"
 * outcomes a person can cause, kept apart so the command can say which. */
export type DeviceFlowFailure = "denied" | "expired";

export class DeviceFlowError extends Error {
  reason: DeviceFlowFailure;
  constructor(reason: DeviceFlowFailure, message: string) {
    super(message);
    this.name = "DeviceFlowError";
    this.reason = reason;
  }
}

/** Start a device authorization. `scope` is a space-delimited request to NARROW
 * the roles (empty = act as the person with everything they have — the usual
 * case). */
export async function requestDeviceCode(apiUrl: string, scope?: string): Promise<DeviceCodeResponse> {
  const fields: Record<string, string> = {};
  if (scope && scope.trim()) fields.scope = scope.trim();
  return (await postForm(`${apiUrl}/iam/auth/device/code`, fields)) as DeviceCodeResponse;
}

/** Injectable clock/sleep so the poll loop is unit-testable without real time. */
export interface PollDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Called before each wait, so a caller can animate "still waiting". */
  onWait?: () => void;
}

const realDeps: PollDeps = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Poll the token endpoint until the request is approved (→ the token), denied,
 * or it expires. Implements the RFC 8628 §3.4/§3.5 client rules:
 *   - `authorization_pending` → keep polling at the current interval;
 *   - `slow_down` → add five seconds to the interval and keep polling;
 *   - `access_denied` → stop (`DeviceFlowError("denied")`);
 *   - `expired_token` → stop (`DeviceFlowError("expired")`);
 * and it also stops with `expired` if `expires_in` elapses locally, so a server
 * that stops answering never leaves the CLI polling forever. Any other error
 * (network, `invalid_grant`) propagates. */
export async function pollForToken(
  apiUrl: string,
  device: Pick<DeviceCodeResponse, "device_code" | "interval" | "expires_in">,
  deps: PollDeps = realDeps,
): Promise<DeviceTokenResponse> {
  let intervalMs = Math.max(1, device.interval) * 1000;
  const deadline = deps.now() + device.expires_in * 1000;

  for (;;) {
    if (deps.now() >= deadline) {
      throw new DeviceFlowError("expired", "The login request expired before it was approved. Run login again.");
    }
    deps.onWait?.();
    await deps.sleep(intervalMs);

    try {
      return (await postForm(`${apiUrl}/iam/auth/token`, {
        grant_type: GRANT_DEVICE_CODE,
        device_code: device.device_code,
      })) as DeviceTokenResponse;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      switch (error.oauthError) {
        case "authorization_pending":
          continue;
        case "slow_down":
          intervalMs += 5000;
          continue;
        case "access_denied":
          throw new DeviceFlowError("denied", "The login request was denied in the console.");
        case "expired_token":
          throw new DeviceFlowError("expired", "The login request expired before it was approved. Run login again.");
        default:
          throw error;
      }
    }
  }
}
