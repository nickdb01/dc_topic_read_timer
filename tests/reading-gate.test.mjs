import assert from "node:assert/strict";
import { test } from "node:test";
import ReadingGate from "../javascripts/discourse/lib/reading-gate.js";
const settings = { enabled: true, required_reading_minutes: 5, maximum_restricted_trust_level: 0 };
function make(fetchUser, extras = {}) {
  return new ReadingGate({ getUser: () => ({ id: 19, trust_level: 0 }), getSettings: () => settings, fetchUser, onChange: () => {}, ...extras });
}
test("failure stays restricted and a later persisted timing update unlocks", async () => {
  let fail = true;
  const gate = make(async () => {
    if (fail) { throw new Error("429"); }
    return { user: { id: 19, time_read: 300, trust_level: 0 } };
  });
  await gate.refresh();
  assert.equal(gate.failed, true);
  assert.equal(gate.restricted, true);
  fail = false;
  await gate.refresh({ force: true });
  assert.equal(gate.failed, false);
  assert.equal(gate.restricted, false);
});
test("page/focus checks are throttled and eligible unlocked users stop requesting", async () => {
  let calls = 0, seconds = 10;
  const gate = make(async () => { calls++; return { user: { id: 19, time_read: seconds } }; }, { now: () => 100000 });
  await gate.refresh();
  await gate.refresh();
  assert.equal(calls, 1);
  seconds = 300;
  await gate.refresh({ force: true });
  await gate.refresh({ force: true });
  assert.equal(calls, 2);
});
test("destroyed or switched-user responses cannot grant access", async () => {
  let finish;
  const gate = make(() => new Promise((resolve) => { finish = resolve; }));
  const request = gate.refresh();
  gate.destroy();
  finish({ user: { id: 19, time_read: 300 } });
  await request;
  assert.equal(gate.seconds, null);
});
test("higher trust returned by core unlocks without a custom promotion timer", async () => {
  const gate = make(async () => ({ user: { id: 19, time_read: 0, trust_level: 1 } }));
  await gate.refresh();
  assert.equal(gate.restricted, false);
});
