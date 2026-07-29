import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { applyFailOn } from "./severity-gate.js";

// process.exitCode is global mutable state shared with the test runner
// process itself — reset it around every test so a "failing" assertion here
// doesn't make `node --test` exit non-zero for the whole suite.
beforeEach(() => {
  process.exitCode = undefined;
});
afterEach(() => {
  process.exitCode = undefined;
});

test("no-op when --fail-on is not provided", () => {
  applyFailOn("critical", undefined);
  assert.equal(process.exitCode, undefined);
});

test("no-op when there is no worst finding (nothing scanned)", () => {
  applyFailOn(null, "low");
  assert.equal(process.exitCode, undefined);
});

test("throws on an invalid --fail-on value", () => {
  assert.throws(() => applyFailOn("critical", "extreme"), /--fail-on must be one of/);
});

test("sets exit code 1 when worst severity meets the threshold exactly", () => {
  applyFailOn("critical", "critical");
  assert.equal(process.exitCode, 1);
});

test("sets exit code 1 when worst severity exceeds the threshold", () => {
  applyFailOn("critical", "high");
  assert.equal(process.exitCode, 1);
});

test("does not set exit code when worst severity is below the threshold", () => {
  applyFailOn("high", "critical");
  assert.equal(process.exitCode, undefined);
});

test("medium worst meets a low threshold", () => {
  applyFailOn("medium", "low");
  assert.equal(process.exitCode, 1);
});

test("info worst does not meet a low threshold", () => {
  applyFailOn("info", "low");
  assert.equal(process.exitCode, undefined);
});

test("every severity meets an info threshold", () => {
  for (const worst of ["critical", "high", "medium", "low", "info"] as const) {
    process.exitCode = undefined;
    applyFailOn(worst, "info");
    assert.equal(process.exitCode, 1, `expected ${worst} to meet info threshold`);
  }
});
