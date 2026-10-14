import { registerDestructor } from "@ember/destroyable";
import { settings, themePrefix } from "virtual:theme";
import { ajax } from "discourse/lib/ajax";
import { apiInitializer } from "discourse/lib/api";
import DiscourseURL, { userPath } from "discourse/lib/url";
import { i18n } from "discourse-i18n";
import ReadingGate from "../lib/reading-gate";
import { newTopicAction } from "../lib/reading-policy";
import TopicButtonAdapter from "../lib/topic-button-adapter";

export default apiInitializer((api) => {
  if (!api.getCurrentUser() || !settings.enabled) {
    return;
  }
  const appEvents = api.container.lookup("service:app-events");
  const composer = api.container.lookup("service:composer");
  const dialog = api.container.lookup("service:dialog");
  const tooltip = api.container.lookup("service:tooltip");
  const modal = api.container.lookup("service:modal");
  const readingMessage = () =>
    i18n(themePrefix("reading_requirement.explanation"), {
      minutes: settings.required_reading_minutes,
    });
  const message = () =>
    `${readingMessage()}. ${i18n(themePrefix("reading_requirement.guidelines_prompt"))}`;
  const openGuidelines = () => {
    // Close an existing share modal, then let core handle topic loading,
    // canonical URLs, localisation, history and normal reading tracking.
    modal.close();
    DiscourseURL.routeTo(`/t/${settings.guidelines_topic_id}`);
  };

  let adapter;
  const gate = new ReadingGate({
    getUser: () => api.getCurrentUser(),
    getSettings: () => settings,
    fetchUser: (user) =>
      ajax(
        userPath(
          `${encodeURIComponent(user.username_lower || user.username)}/card.json`
        )
      ),
    onChange: () => adapter?.queueSync(),
  });
  adapter = new TopicButtonAdapter({
    gate,
    tooltip,
    message,
    shareLabel: i18n("post.reply_as_new_topic"),
    onLockedClick: openGuidelines,
  });

  const explain = () =>
    dialog.alert(
      gate.failed
        ? i18n(themePrefix("reading_requirement.check_failed"))
        : readingMessage()
    );

  // Constant variant; locked state is owned only by the adapter, not a cached
  // template getter. Core supplies all tertiary/hover/icon colour variables.
  api.registerValueTransformer("create-topic-button-class", ({ value }) =>
    value.includes("btn-primary") ? value : [...value, "btn-primary"]
  );

  api.registerBehaviorTransformer("create-topic-button-click", ({ next }) => {
    if (gate.restricted) {
      openGuidelines();
      gate.refresh();
      return;
    }
    return next();
  });
  // Core sets the composer service's model after the model-level composer-open
  // transformer, so returning early from that transformer cannot cancel opening.
  // Use the standard service event to close only an actual new-topic composer.
  const onComposerOpen = ({ model } = {}) => {
    if (gate.restricted && newTopicAction(model?.action)) {
      composer.close();
      explain();
      gate.refresh();
    }
  };
  const onTimings = () => gate.refresh({ force: true });
  const onPageChange = () => {
    adapter.queueSync();
    gate.refresh();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") {
      gate.refresh();
    }
  };
  const onFocus = () => gate.refresh();

  api.registerValueTransformer(
    "composer-service-cannot-submit-post",
    ({ value, context }) =>
      value || (gate.restricted && newTopicAction(context.model?.action))
  );
  api.onPageChange(onPageChange);
  appEvents.on("composer:open", onComposerOpen);
  appEvents.on("topic:timings-sent", onTimings);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisible);
  registerDestructor(appEvents, () => {
    appEvents.off("composer:open", onComposerOpen);
    appEvents.off("topic:timings-sent", onTimings);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisible);
    gate.destroy();
    adapter.destroy();
  });

  adapter.queueSync();
  gate.refresh();
});
