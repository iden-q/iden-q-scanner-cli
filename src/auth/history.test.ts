import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDomainSession,
  addFolderSession,
  emptySnapshot,
  newDomainSession,
  newFolderSession,
  normalizeSnapshot,
  type FolderSession,
} from "./history.js";

test("normalizeSnapshot coerces anything into a well-formed snapshot", () => {
  assert.deepEqual(normalizeSnapshot(null), emptySnapshot());
  assert.deepEqual(normalizeSnapshot("nope"), emptySnapshot());
  assert.deepEqual(normalizeSnapshot({ folderSessions: "x", domainSessions: 3 }), emptySnapshot());
  const good = { folderSessions: [{ id: "1", timestamp: 1, label: "a", results: [] }], domainSessions: [] };
  assert.deepEqual(normalizeSnapshot(good), good);
});

test("newFolderSession/newDomainSession stamp a unique id and the given time", () => {
  const a = newFolderSession("src", [], 42);
  const b = newFolderSession("src", [], 42);
  assert.equal(a.timestamp, 42);
  assert.equal(a.label, "src");
  assert.notEqual(a.id, b.id, "each session gets its own id");
  assert.equal(newDomainSession("example.com", [], 7).label, "example.com");
});

test("adding a session appends it and keeps sessions ordered by time", () => {
  let snap = emptySnapshot();
  snap = addFolderSession(snap, newFolderSession("late", [], 200));
  snap = addFolderSession(snap, newFolderSession("early", [], 100));
  assert.deepEqual(
    snap.folderSessions.map((s) => s.label),
    ["early", "late"],
  );
});

test("re-adding the same session id is idempotent (dedupe by id), matching the web's merge", () => {
  const session: FolderSession = { id: "fixed", timestamp: 100, label: "once", results: [] };
  let snap = emptySnapshot();
  snap = addFolderSession(snap, session);
  snap = addFolderSession(snap, session);
  assert.equal(snap.folderSessions.length, 1);
});

test("folder and domain sessions live in their own lists and do not clobber each other", () => {
  let snap = emptySnapshot();
  snap = addFolderSession(snap, newFolderSession("src", [], 1));
  snap = addDomainSession(snap, newDomainSession("example.com", [], 2));
  assert.equal(snap.folderSessions.length, 1);
  assert.equal(snap.domainSessions.length, 1);
});
