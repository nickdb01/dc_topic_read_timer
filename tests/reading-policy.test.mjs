import assert from "node:assert/strict";
import { test } from "node:test";
import { eligibleUser, restrictedUser, newTopicAction, readingSnapshot } from "../javascripts/discourse/lib/reading-policy.js";
const settings = { enabled: true, required_reading_minutes: 5, maximum_restricted_trust_level: 0 };
const user = { id: 19, trust_level: 0 };

test("reading seconds unlock exactly at the configured boundary", () => {
  assert.equal(restrictedUser(user, settings, null), true);
  assert.equal(restrictedUser(user, settings, 299), true);
  assert.equal(restrictedUser(user, settings, 300), false);
  assert.equal(restrictedUser(user, { ...settings, required_reading_minutes: 10 }, 300), true);
});
test("only configured trust levels are gated, with guest/staff/anonymous exemptions", () => {
  for (const exempt of [null, { ...user, trust_level: 1 }, { ...user, staff: true }, { ...user, admin: true }, { ...user, moderator: true }, { ...user, is_anonymous: true }]) {
    assert.equal(eligibleUser(exempt, settings), false);
  }
  assert.equal(eligibleUser({ ...user, trust_level: 1 }, { ...settings, maximum_restricted_trust_level: 1 }), true);
  assert.equal(restrictedUser(user, { ...settings, enabled: false }), false);
  assert.equal(restrictedUser(user, { ...settings, required_reading_minutes: 0 }), false);
});
test("reply, edit and private-message actions are never treated as new topics", () => {
  for (const action of ["reply", "edit", "privateMessage", undefined]) {
    assert.equal(newTopicAction(action), false);
  }
  assert.equal(newTopicAction("createTopic"), true);
  assert.equal(newTopicAction("createSharedDraft"), true);
});
test("the server snapshot must contain this user's numeric reading time", () => {
  assert.deepEqual(readingSnapshot({ user: { id: 19, time_read: 300, trust_level: 0 } }, 19), { seconds: 300, trustLevel: 0 });
  for (const response of [{}, { user: { id: 20, time_read: 300 } }, { user: { id: 19 } }, { user: { id: 19, time_read: null } }, { user: { id: 19, time_read: -1 } }]) {
    assert.throws(() => readingSnapshot(response, 19));
  }
});
