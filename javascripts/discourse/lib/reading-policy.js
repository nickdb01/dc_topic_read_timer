export function eligibleUser(user, settings) {
  return Boolean(
    settings.enabled &&
    Number(settings.required_reading_minutes) > 0 &&
    user &&
    !user.admin &&
    !user.moderator &&
    !user.staff &&
    !user.is_anonymous &&
    Number(user.trust_level ?? 0) <=
      Number(settings.maximum_restricted_trust_level)
  );
}

export function restrictedUser(user, settings, seconds = null) {
  return (
    eligibleUser(user, settings) &&
    (seconds === null ||
      !Number.isFinite(seconds) ||
      seconds < Number(settings.required_reading_minutes) * 60)
  );
}

export function newTopicAction(action) {
  return action === "createTopic" || action === "createSharedDraft";
}

export function readingSnapshot(response, userId) {
  const user = response?.user;
  if (
    Number(user?.id) !== Number(userId) ||
    typeof user?.time_read !== "number" ||
    !Number.isFinite(user.time_read) ||
    user.time_read < 0
  ) {
    throw new Error("Reading time is unavailable");
  }
  return { seconds: user.time_read, trustLevel: user.trust_level };
}
