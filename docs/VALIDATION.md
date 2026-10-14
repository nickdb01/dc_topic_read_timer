# Validation

## Local checks

Run `npm test`: policy/request unit tests, real .gjs preprocessing where applicable, Discourse lint configs, styling, formatting and locale key validation.

## Discourse integration checks

The official reusable theme workflow runs test/acceptance/read-before-topic-test.js against real core. Coverage includes the unavailable main button and native tooltip, unlocking at 300 seconds after a core timing update, native replies, the share-modal new-topic button, alternate composer entry, request failure/recovery, mobile taps, higher trust and staff exemptions.

See this repository's Actions runs for actual results. Local policy tests do not replace native browser tests.

The unlock regression compares computed background, text, border and opacity with a native primary button, checks lock SVG presence and original icon restoration, and verifies cleanup persists after navigation. It also checks primary styling for exempt users and lock markup on mobile and public share controls. Theme QUnit deliberately loads core common CSS with theme_id: nil, excluding component CSS. Enabled colours are verified against the real core primary variant; locked-icon hiding is checked by matching its scoped selector against native markup. Verify the actual muted colours and hidden original icon on the installed site.

## Installation checks

- Enable on every active theme that should enforce the browser rule.
- Test a real non-staff TL0 user below the threshold, at five minutes and above it.
- Verify all topic-list filters, category/tag lists and dynamically opened category cards.
- Tooltip works on hover, keyboard focus, touch; Escape closes it.
- Reply buttons, quotes, edits, private messages and reply drafts remain available.
- Reply as new topic and existing new-topic drafts remain restricted.
- Core timing updates unlock automatically; background-tab time is counted only if core counts it.
- A failed initial request stays restricted; reconnecting and recording reading retries.
- Category permissions and existing disabled controls are preserved.
- All supported locales, RTL, mobile Safari and Chromium.
- Unattached themes, custom buttons and direct API clients are outside the browser guarantee.

Version 1.0.3 acceptance tests cover the expanded tooltip, core navigation to the configured guidelines topic, custom topic ID, mobile taps and share-modal cleanup, while retaining reading unlock and reply coverage. Installation: verify the configured guidelines topic is accessible and translated normally on your site, and keyboard/touch activation opens it in the same tab.
