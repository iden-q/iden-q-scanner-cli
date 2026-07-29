import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { walk, isBinaryCert } from "./fs-walk.js";

let root: string;

before(() => {
  root = mkdtempSync(join(tmpdir(), "q-scanner-walk-"));

  // files that should be found
  writeFileSync(join(root, "a.txt"), "a");
  mkdirSync(join(root, "sub"));
  writeFileSync(join(root, "sub", "b.txt"), "b");
  mkdirSync(join(root, "sub", "deeper"));
  writeFileSync(join(root, "sub", "deeper", "c.txt"), "c");

  // pruned directories — must not be descended into
  mkdirSync(join(root, "node_modules"));
  writeFileSync(join(root, "node_modules", "skip.txt"), "skip");
  mkdirSync(join(root, ".git"));
  writeFileSync(join(root, ".git", "skip.txt"), "skip");
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "dist", "skip.txt"), "skip");

  // empty dir — contributes no files but should not error
  mkdirSync(join(root, "empty"));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

test("walk finds files recursively and prunes SKIP_DIRS", async () => {
  const files = await walk(root);
  const paths = files.map((f) => f.path).sort();

  assert.deepEqual(paths, [join("sub", "b.txt"), join("sub", "deeper", "c.txt"), "a.txt"].sort());
});

test("walk returns absolutePath joined with root", async () => {
  const files = await walk(root);
  const a = files.find((f) => f.path === "a.txt");
  assert.ok(a);
  assert.equal(a!.absolutePath, join(root, "a.txt"));
});

test("walk never returns anything under node_modules/.git/dist", async () => {
  const files = await walk(root);
  for (const f of files) {
    assert.doesNotMatch(f.path, /node_modules/);
    assert.doesNotMatch(f.path, /(^|\/)\.git(\/|$)/);
    assert.doesNotMatch(f.path, /(^|\/)dist(\/|$)/);
  }
});

test("walk on a single file returns just that file", async () => {
  const filePath = join(root, "a.txt");
  const files = await walk(filePath);
  assert.deepEqual(files, [{ path: filePath, absolutePath: filePath }]);
});

test("isBinaryCert recognizes known binary cert extensions case-insensitively", () => {
  assert.equal(isBinaryCert("key.der"), true);
  assert.equal(isBinaryCert("bundle.P12"), true);
  assert.equal(isBinaryCert("cert.pfx"), true);
  assert.equal(isBinaryCert("box.pkcs12"), true);
  assert.equal(isBinaryCert("report.pdf"), true);
});

test("isBinaryCert rejects non-cert extensions", () => {
  assert.equal(isBinaryCert("index.ts"), false);
  assert.equal(isBinaryCert("key.pem"), false);
  assert.equal(isBinaryCert("noext"), false);
});
