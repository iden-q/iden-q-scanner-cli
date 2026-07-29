import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLocale } from "./locale.js";

test("resolveLocale defaults to 'en' when --lang is not provided", () => {
  assert.equal(resolveLocale(undefined), "en");
});

test("resolveLocale accepts 'en' and 'es'", () => {
  assert.equal(resolveLocale("en"), "en");
  assert.equal(resolveLocale("es"), "es");
});

test("resolveLocale throws on an unsupported language", () => {
  assert.throws(() => resolveLocale("fr"), /--lang must be one of/);
});
