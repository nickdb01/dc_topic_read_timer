import {
  click,
  currentURL,
  settled,
  visit,
  waitUntil,
} from "@ember/test-helpers";
import { test } from "qunit";
import { settings } from "virtual:theme";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";

const LOCKED = "#create-topic[aria-disabled='true']";
const TOPIC = "/t/internationalization-localization/280";
function appearance(button) {
  const style = getComputedStyle(button);
  return {
    background: style.backgroundColor,
    color: style.color,
    border: style.borderColor,
    opacity: style.opacity,
  };
}

function nativeAppearance(button) {
  // Read the same button without our state synchronously, before repaint. This
  // preserves native ID, ancestor, sibling and theme selectors in the reference.
  button.removeAttribute("aria-disabled");
  button.removeAttribute("data-dc-reading-locked");
  button.classList.remove("dc-topic-reading-locked");
  const result = appearance(button);
  button.setAttribute("aria-disabled", "true");
  button.setAttribute("data-dc-reading-locked", "true");
  button.classList.add("dc-topic-reading-locked");
  return result;
}
function primaryAppearance(button) {
  const reference = document.createElement("button");
  reference.className = "btn btn-primary";
  button.after(reference);
  const result = appearance(reference);
  reference.remove();
  return result;
}

function configure(needs, user = {}, mobile = false) {
  needs.user({
    admin: false,
    moderator: false,
    staff: false,
    trust_level: 0,
    ...user,
  });
  needs.settings({
    post_menu: "read|like|share|flag|edit|bookmark|delete|admin|reply|copyLink",
  });
  if (mobile) {
    needs.mobileView();
  }
  needs.hooks.beforeEach(() => {
    settings.enabled = true;
    settings.required_reading_minutes = 5;
    settings.maximum_restricted_trust_level = 0;
    settings.guidelines_topic_id = 130;
  });
}
function card(helper, seconds, trustLevel = 0) {
  return helper.response({
    user: { id: 19, time_read: seconds, trust_level: trustLevel },
  });
}

acceptance("Read Before New Topic - restricted user", function (needs) {
  configure(needs);
  let seconds, fail;
  needs.hooks.beforeEach(() => {
    seconds = 299;
    fail = false;
  });
  needs.pretender((server, helper) => {
    server.get("/u/eviltrout/card.json", () =>
      fail
        ? [
            429,
            { "Content-Type": "application/json" },
            JSON.stringify({ errors: ["Rate limited"] }),
          ]
        : card(helper, seconds)
    );
  });

  test("New Topic is unavailable and native tooltip explains the configured threshold", async function (assert) {
    await visit("/latest");
    await waitUntil(() => document.querySelector(LOCKED));
    document.querySelector("#create-topic").focus();
    await waitUntil(() => document.querySelector(".fk-d-tooltip__content"));
    assert
      .dom(".fk-d-tooltip__content")
      .hasText(
        "New topics will be enabled after 5 minutes of reading on the community. Click to see our guidelines."
      );
    await click("#create-topic");
    await waitUntil(() => /\/130(?:\/|$)/.test(currentURL()));
    assert
      .dom(".topic-post")
      .exists("core renders the configured guidelines topic");
    assert.false(Boolean(this.container.lookup("service:composer").model));
  });

  test("configured guidelines topic is used on locked clicks", async function (assert) {
    await visit("/latest");
    await waitUntil(() => document.querySelector(LOCKED));
    settings.guidelines_topic_id = 280;
    await click("#create-topic");
    await waitUntil(() => /\/280(?:\/|$)/.test(currentURL()));
    assert.dom(".topic-post").exists();
    assert.false(Boolean(this.container.lookup("service:composer").model));
  });

  test("persisted reading time unlocks automatically at exactly 300 seconds", async function (assert) {
    await visit("/latest");
    await waitUntil(() => document.querySelector(LOCKED));
    seconds = 300;
    const button = document.querySelector("#create-topic");
    assert.dom("#create-topic .d-icon-lock.dc-topic-reading-lock").exists();
    assert
      .dom("#create-topic .dc-topic-reading-lock")
      .hasAttribute("aria-hidden", "true");
    const originalIcon = button.querySelector(
      ".d-icon:not(.dc-topic-reading-lock)"
    );
    // Theme QUnit intentionally loads core CSS with theme_id: nil. Verify our
    // hiding selector against real core markup; visual CSS is an install check.
    assert.true(
      originalIcon.matches(
        ".dc-topic-reading-locked[data-dc-reading-locked='true'] .d-icon:not(.dc-topic-reading-lock)"
      ),
      "original icon is covered by the scoped unavailable-style selector"
    );
    const expected = nativeAppearance(button);
    assert.deepEqual(
      expected,
      primaryAppearance(button),
      "enabled reference uses core's tertiary primary variant"
    );
    this.container
      .lookup("service:app-events")
      .trigger("topic:timings-sent", {});
    await waitUntil(() => !document.querySelector(LOCKED));
    assert.dom("#create-topic").doesNotHaveClass("dc-topic-reading-locked");
    assert.dom("#create-topic .dc-topic-reading-lock").doesNotExist();
    assert.dom("#create-topic").doesNotHaveAttribute("data-dc-reading-locked");
    assert.deepEqual(
      appearance(document.querySelector("#create-topic")),
      expected,
      "unlock restores native theme colours"
    );
    assert.notStrictEqual(
      getComputedStyle(originalIcon).display,
      "none",
      "native icon is restored on unlock"
    );
    await visit("/categories");
    await visit("/latest");
    assert.dom("#create-topic").doesNotHaveClass("dc-topic-reading-locked");
    assert.dom("#create-topic .dc-topic-reading-lock").doesNotExist();
    assert.dom("#create-topic").doesNotHaveAttribute("data-dc-reading-locked");
    assert.deepEqual(
      appearance(document.querySelector("#create-topic")),
      expected,
      "native styling survives core rendering after navigation"
    );
    await click("#create-topic");
    assert.strictEqual(
      this.container.lookup("service:composer").model.action,
      "createTopic"
    );
  });

  test("standard replies remain available", async function (assert) {
    await visit(TOPIC);
    await click(".topic-post[data-post-number='1'] button.reply");
    assert.dom(".d-editor-input").exists();
    assert.strictEqual(
      this.container.lookup("service:composer").model.action,
      "reply"
    );
  });

  test("share modal's reply-as-new-topic button is also unavailable", async function (assert) {
    await visit(TOPIC);
    await click(".topic-post[data-post-number='1'] button.share");
    await waitUntil(() =>
      document.querySelector("button.new-topic[aria-disabled='true']")
    );
    assert.dom("button.new-topic .d-icon-lock.dc-topic-reading-lock").exists();
    await click("button.new-topic");
    assert.false(Boolean(this.container.lookup("service:composer").model));
    await waitUntil(() => /\/130(?:\/|$)/.test(currentURL()));
    assert.dom(".share-topic-modal").doesNotExist();
    assert.dom(".topic-post").exists();
  });

  test("alternate new-topic entry cannot leave a topic composer open", async function (assert) {
    await visit("/latest");
    await this.container.lookup("service:composer").openNewTopic();
    await settled();
    assert.false(Boolean(this.container.lookup("service:composer").model));
    assert.dom(".dialog-body").includesText("5 minutes");
  });

  test("a failed refresh retains the restriction and a later timing update recovers", async function (assert) {
    await visit("/latest");
    await waitUntil(() => document.querySelector(LOCKED));
    fail = true;
    this.container
      .lookup("service:app-events")
      .trigger("topic:timings-sent", {});
    assert.dom(LOCKED).exists();
    fail = false;
    seconds = 300;
    this.container
      .lookup("service:app-events")
      .trigger("topic:timings-sent", {});
    await waitUntil(() => !document.querySelector(LOCKED));
    assert.dom("#create-topic").doesNotHaveAttribute("aria-disabled", "true");
  });
});

acceptance("Read Before New Topic - mobile", function (needs) {
  configure(needs, {}, true);
  needs.pretender((server, helper) => {
    server.get("/u/eviltrout/card.json", () => card(helper, 0));
  });
  test("tap opens the guidelines topic without opening a composer", async function (assert) {
    await visit("/latest");
    await waitUntil(() => document.querySelector(LOCKED));
    assert.dom("#create-topic .d-icon-lock.dc-topic-reading-lock").exists();
    await click("#create-topic");
    await waitUntil(() => /\/130(?:\/|$)/.test(currentURL()));
    assert.dom(".topic-post").exists();
    assert.false(Boolean(this.container.lookup("service:composer").model));
  });
});

acceptance("Read Before New Topic - established user", function (needs) {
  configure(needs, { trust_level: 1 });
  test("higher trust users keep normal topic controls", async function (assert) {
    await visit("/latest");
    assert.dom("#create-topic").hasClass("btn-primary");
    assert.dom("#create-topic .dc-topic-reading-lock").doesNotExist();
    assert.deepEqual(
      appearance(document.querySelector("#create-topic")),
      primaryAppearance(document.querySelector("#create-topic")),
      "exempt users also get the tertiary primary variant"
    );
    assert.dom("#create-topic").doesNotHaveAttribute("aria-disabled", "true");
    await click("#create-topic");
    assert.strictEqual(
      this.container.lookup("service:composer").model.action,
      "createTopic"
    );
  });
});

acceptance("Read Before New Topic - staff", function (needs) {
  configure(needs, { admin: true });
  test("staff are exempt even at trust level zero", async function (assert) {
    await visit("/latest");
    assert.dom("#create-topic").doesNotHaveAttribute("aria-disabled", "true");
  });
});
