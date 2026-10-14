import {
  eligibleUser,
  readingSnapshot,
  restrictedUser,
} from "./reading-policy.js";

export default class ReadingGate {
  seconds = null;
  failed = false;
  destroyed = false;
  lastCheckedAt = 0;
  inFlight = null;
  requestId = 0;
  recheck = false;
  trustLevel = null;
  requestedTrustLevel = null;

  constructor({ getUser, getSettings, fetchUser, onChange, now = Date.now }) {
    Object.assign(this, { getUser, getSettings, fetchUser, onChange, now });
  }

  get policyUser() {
    const user = this.getUser();
    if (
      user &&
      this.trustLevel !== null &&
      user.trust_level === this.requestedTrustLevel
    ) {
      return {
        ...user,
        trust_level: this.trustLevel,
        admin: user.admin,
        moderator: user.moderator,
        staff: user.staff,
        is_anonymous: user.is_anonymous,
      };
    }
    return user;
  }

  get restricted() {
    return restrictedUser(this.policyUser, this.getSettings(), this.seconds);
  }

  refresh({ force = false } = {}) {
    if (this.destroyed || !eligibleUser(this.policyUser, this.getSettings())) {
      this.onChange?.();
      return Promise.resolve();
    }
    if (!this.restricted && this.seconds !== null) {
      this.onChange?.();
      return Promise.resolve();
    }
    if (this.inFlight) {
      this.recheck ||= force;
      return this.inFlight;
    }
    if (
      !force &&
      this.lastCheckedAt &&
      this.now() - this.lastCheckedAt < 15000
    ) {
      return Promise.resolve();
    }

    const user = this.getUser();
    const userId = user.id;
    const requestId = ++this.requestId;
    this.requestedTrustLevel = user.trust_level;
    this.lastCheckedAt = this.now();
    this.inFlight = this.check(userId, requestId);
    return this.inFlight;
  }

  async check(userId, requestId) {
    try {
      const response = await this.fetchUser(this.getUser());
      if (
        this.destroyed ||
        requestId !== this.requestId ||
        this.getUser()?.id !== userId
      ) {
        return;
      }
      const snapshot = readingSnapshot(response, userId);
      this.seconds = snapshot.seconds;
      this.trustLevel = Number.isFinite(snapshot.trustLevel)
        ? snapshot.trustLevel
        : null;
      this.failed = false;
    } catch {
      if (!this.destroyed && requestId === this.requestId) {
        this.failed = true;
      }
    } finally {
      if (!this.destroyed && requestId === this.requestId) {
        this.inFlight = null;
        this.onChange?.();
        if (this.recheck) {
          this.recheck = false;
          this.refresh({ force: true });
        }
      }
    }
  }

  destroy() {
    this.destroyed = true;
    this.requestId++;
    this.onChange = null;
  }
}
