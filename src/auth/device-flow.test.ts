import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { pollForToken, requestDeviceCode, DeviceFlowError, type PollDeps } from "./device-flow.js";
import { ApiError } from "./http.js";

interface Queued {
  status: number;
  body: unknown;
}

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Stub global fetch with a queue of responses, popped one per request. */
function queueFetch(responses: Queued[]): { calls: () => number } {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    const next = responses.shift();
    if (!next) throw new Error("device-flow test: fetch called more times than queued");
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { calls: () => calls };
}

const DEVICE = { device_code: "dc", interval: 5, expires_in: 900 };
const SUCCESS = { status: 200, body: { access_token: "a", refresh_token: "r", token_type: "Bearer", expires_in: 900 } };

/** Deps whose clock never reaches the deadline, so the loop is driven purely by
 * the queued responses; `sleep` records its waits instead of waiting. */
function fixedDeps(): { deps: PollDeps; sleeps: number[] } {
  const sleeps: number[] = [];
  return { deps: { now: () => 0, sleep: (ms) => (sleeps.push(ms), Promise.resolve()) }, sleeps };
}

test("requestDeviceCode posts to /iam/auth/device/code and returns the RFC shape", async () => {
  queueFetch([
    {
      status: 200,
      body: {
        device_code: "dc",
        user_code: "WDJB-MJHT",
        verification_uri: "https://platform-dev.idenq.io/device",
        verification_uri_complete: "https://platform-dev.idenq.io/device?user_code=WDJB-MJHT",
        expires_in: 900,
        interval: 5,
      },
    },
  ]);
  const res = await requestDeviceCode("https://dev.idenq.io/api/v1");
  assert.equal(res.user_code, "WDJB-MJHT");
  assert.equal(res.interval, 5);
});

test("pollForToken keeps polling through authorization_pending, then returns the token", async () => {
  const stub = queueFetch([
    { status: 400, body: { error: "authorization_pending" } },
    { status: 400, body: { error: "authorization_pending" } },
    SUCCESS,
  ]);
  const { deps } = fixedDeps();
  const token = await pollForToken("https://x", DEVICE, deps);
  assert.equal(token.access_token, "a");
  assert.equal(stub.calls(), 3);
});

test("slow_down adds five seconds to the interval and keeps polling", async () => {
  queueFetch([{ status: 400, body: { error: "slow_down" } }, SUCCESS]);
  const { deps, sleeps } = fixedDeps();
  await pollForToken("https://x", DEVICE, deps);
  // First wait at the 5s interval, then bumped to 10s before the second poll.
  assert.deepEqual(sleeps, [5000, 10000]);
});

test("access_denied stops with a denied DeviceFlowError", async () => {
  queueFetch([{ status: 400, body: { error: "access_denied" } }]);
  const { deps } = fixedDeps();
  await assert.rejects(pollForToken("https://x", DEVICE, deps), (e) => e instanceof DeviceFlowError && e.reason === "denied");
});

test("expired_token stops with an expired DeviceFlowError", async () => {
  queueFetch([{ status: 400, body: { error: "expired_token" } }]);
  const { deps } = fixedDeps();
  await assert.rejects(pollForToken("https://x", DEVICE, deps), (e) => e instanceof DeviceFlowError && e.reason === "expired");
});

test("an unexpected OAuth error (invalid_grant) propagates as an ApiError, not a DeviceFlowError", async () => {
  queueFetch([{ status: 400, body: { error: "invalid_grant" } }]);
  const { deps } = fixedDeps();
  await assert.rejects(
    pollForToken("https://x", DEVICE, deps),
    (e) => e instanceof ApiError && !(e instanceof DeviceFlowError) && e.oauthError === "invalid_grant",
  );
});

test("the local expiry deadline stops the poll even if the server keeps answering pending", async () => {
  // now() jumps past the deadline on the first loop check, so it never polls.
  let calls = 0;
  const deps: PollDeps = {
    now: () => (calls++ === 0 ? 0 : 999_999_999),
    sleep: () => Promise.resolve(),
  };
  const stub = queueFetch([]); // nothing queued: a poll would throw
  await assert.rejects(
    pollForToken("https://x", { ...DEVICE, expires_in: 10 }, deps),
    (e) => e instanceof DeviceFlowError && e.reason === "expired",
  );
  assert.equal(stub.calls(), 0, "should stop before polling once expired");
});
