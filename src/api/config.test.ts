import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveApiUrl } from "./config.js";

test("an explicit --api-url wins over the environment and the default", () => {
  assert.equal(
    resolveApiUrl("https://dev.idenq.io/api/v1", { IDENQ_API_URL: "https://other" }),
    "https://dev.idenq.io/api/v1",
  );
});

test("IDENQ_API_URL is used when there is no flag", () => {
  assert.equal(resolveApiUrl(undefined, { IDENQ_API_URL: "https://dev.idenq.io/api/v1" }), "https://dev.idenq.io/api/v1");
});

test("defaults to the prod API base when neither is set", () => {
  assert.equal(resolveApiUrl(undefined, {}), "https://idenq.io/api/v1");
});

test("strips trailing slashes so callers can join with a leading-slash path", () => {
  assert.equal(resolveApiUrl("https://idenq.io/api/v1/", {}), "https://idenq.io/api/v1");
  assert.equal(resolveApiUrl("https://idenq.io/api/v1///", {}), "https://idenq.io/api/v1");
});
