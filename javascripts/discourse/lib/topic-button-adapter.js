import { iconElement } from "discourse/lib/icon-library";

// These are core's topic-creation controls, never generic Reply/PM buttons.
// Keep this presentation adapter small: core has no shared disabled/tooltip
// transformer for all three controls. Actions are also guarded through public APIs.
const SELECTOR = [
  "button#create-topic",
  "button.category-card__new-topic",
  "button.new-topic",
].join(",");

export default class TopicButtonAdapter {
  buttons = new Map();
  variants = new Map();
  active = false;
  frame = null;
  destroyed = false;

  constructor({ gate, tooltip, message, shareLabel, onLockedClick }) {
    Object.assign(this, { gate, tooltip, message, shareLabel, onLockedClick });
    this.queueSync = this.queueSync.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  isTopicButton(button) {
    return (
      button?.matches(SELECTOR) &&
      (button.id === "create-topic" ||
        button.classList.contains("category-card__new-topic") ||
        button.getAttribute("aria-label") === this.shareLabel)
    );
  }

  queueSync() {
    if (!this.destroyed && this.frame === null) {
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.sync();
      });
    }
  }

  sync() {
    if (this.destroyed) {
      return;
    }
    if (!this.active) {
      this.active = true;
      document.addEventListener("click", this.onClick, true);
      this.observer = new MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              record.type === "childList" ||
              this.variants.has(record.target) ||
              this.isTopicButton(record.target)
          )
        ) {
          this.queueSync();
        }
      });
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["disabled", "aria-label", "class"],
      });
    }
    for (const [button] of this.buttons) {
      if (
        !button.isConnected ||
        !this.isTopicButton(button) ||
        button.disabled ||
        !this.gate.restricted
      ) {
        this.release(button);
      }
    }
    for (const [button, hadPrimary] of this.variants) {
      if (
        !button.isConnected ||
        !this.isTopicButton(button) ||
        button.disabled
      ) {
        if (!hadPrimary) {
          button.classList.remove("btn-primary");
        }
        this.variants.delete(button);
      }
    }
    for (const button of document.querySelectorAll(SELECTOR)) {
      if (!this.isTopicButton(button) || button.disabled) {
        continue;
      }
      if (!this.variants.has(button)) {
        this.variants.set(button, button.classList.contains("btn-primary"));
      }
      // Use core's primary variant, including its tertiary palette, icon colour,
      // hover/focus states and disabled permissions. Never hard-code blue.
      if (!button.classList.contains("btn-primary")) {
        button.classList.add("btn-primary");
      }
      if (this.gate.restricted) {
        if (!this.buttons.has(button)) {
          this.decorate(button);
        }
        this.ensureLockIcon(button);
      }
    }
  }

  ensureLockIcon(button) {
    const state = this.buttons.get(button);
    if (!button.contains(state.icon)) {
      button.prepend(state.icon);
    }
    if (!button.classList.contains("dc-topic-reading-locked")) {
      button.classList.add("dc-topic-reading-locked");
    }
  }

  decorate(button) {
    const previousAria = button.getAttribute("aria-disabled");
    // aria-disabled keeps the explanation reachable by keyboard and touch.
    // Never overwrite a native disabled permission or remove a core control.
    button.setAttribute("aria-disabled", "true");
    // One owner for presentation: do not also inject the class through a core
    // template getter, which can cache/reapply it after the gate has unlocked.
    button.setAttribute("data-dc-reading-locked", "true");
    button.classList.add("dc-topic-reading-locked");
    const instance = this.tooltip.register(button, {
      content: this.message(),
      ariaLabel: this.message(),
      identifier: "dc-topic-reading",
      triggers: ["hover"],
      untriggers: ["hover"],
      placement: "bottom",
      maxWidth: 350,
      trapTab: false,
    });
    const focus = () => instance.show();
    const blur = () => instance.close();
    button.addEventListener("focus", focus);
    button.addEventListener("blur", blur);
    const icon = iconElement("lock", { class: "dc-topic-reading-lock" });
    this.buttons.set(button, { previousAria, instance, focus, blur, icon });
    this.ensureLockIcon(button);
  }

  onClick(event) {
    const button =
      event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (
      !this.gate.restricted ||
      !this.isTopicButton(button) ||
      button.disabled
    ) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.buttons.has(button)) {
      this.decorate(button);
    }
    button.focus({ preventScroll: true });
    this.buttons.get(button).instance.close();
    this.onLockedClick();
    this.gate.refresh();
  }

  release(button) {
    const state = this.buttons.get(button);
    if (!state) {
      return;
    }
    state.instance.destroy();
    state.icon.remove();
    button.removeEventListener("focus", state.focus);
    button.removeEventListener("blur", state.blur);
    button.classList.remove("dc-topic-reading-locked");
    button.removeAttribute("data-dc-reading-locked");
    if (button.getAttribute("aria-disabled") === "true") {
      if (state.previousAria === null) {
        button.removeAttribute("aria-disabled");
      } else {
        button.setAttribute("aria-disabled", state.previousAria);
      }
    }
    this.buttons.delete(button);
  }

  deactivate() {
    this.active = false;
    this.observer?.disconnect();
    document.removeEventListener("click", this.onClick, true);
    for (const [button] of this.buttons) {
      this.release(button);
    }
  }

  destroy() {
    this.destroyed = true;
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
    }
    this.deactivate();
    for (const [button, hadPrimary] of this.variants) {
      if (!hadPrimary) {
        button.classList.remove("btn-primary");
      }
    }
    this.variants.clear();
  }
}
