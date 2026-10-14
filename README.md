# Topic Read Timer

A standalone Discourse theme component that requires recorded reading time before eligible users can create new topics. Replies, editing and private messages remain available.

Version: **1.0.3**. Requires Discourse **2026.10.0-latest** or newer.

## Installation

1. Open **Admin > Appearance > Themes & components > Components > Install**.
2. Choose **From a Git repository** and enter:
   `https://github.com/nickdb01/dc_topic_read_timer`
3. Include the component on each theme where the restriction should apply.
4. Configure `guidelines_topic_id` for your forum and verify that restricted users can access that topic.

## Settings

| Setting | Default | Behaviour |
| --- | --- | --- |
| `enabled` | `true` | Enable the component. |
| `required_reading_minutes` | `5` | Required lifetime reading time in minutes. Zero disables the reading gate. |
| `maximum_restricted_trust_level` | `0` | Restrict this trust level and lower levels. Staff are always exempt. |
| `guidelines_topic_id` | `4` | Topic opened by a locked New Topic click. Set this to your forum's guidelines topic ID. |

## Behaviour

Eligible users see a lock icon and a tooltip explaining the configured reading requirement. Clicking the locked control opens the configured guidelines topic in the same tab. Once Discourse records sufficient reading time, the control unlocks automatically and uses the theme's native primary button appearance.

The threshold is total lifetime reading time, rather than time remaining or account age. Older accounts within the configured trust levels can also be restricted.

Reading time comes from Discourse's `UserStat.time_read`, in seconds, through the user card endpoint. The component does not count time itself, fabricate reading activity, store member data or change trust levels. Checks refresh after persisted reading updates, navigation, focus and visibility restoration. Requests are coalesced and ordinary refreshes throttled. Eligible users remain restricted while the initial check is pending or fails.

Replies, quote replies, editing, private messages and reply drafts remain available. Reply as new topic and opening new-topic drafts are restricted. Existing drafts are retained. Category permissions remain in force; the component never grants permission to create topics. Staff, higher trust levels, logged-out visitors and anonymous-mode accounts retain core behaviour.

## Languages

User-facing strings are included for English, British English, German, Dutch, French, Spanish, Portuguese, Brazilian Portuguese, Italian and Turkish. Controls use Discourse's active locale.

## Scope

This is a browser restriction. Direct API requests, modified clients and themes without the component can bypass it. Enforcing the exact threshold server-side requires separate support.

The component targets standard desktop and mobile topic-creation controls. Custom controls provided by third-party themes or plugins may require additional integration.

## Development and validation

Use Node 22 or newer:

```sh
npm ci
npm test
```

The workflow runs unit tests, template compilation checks, linting, formatting, locale validation and official Discourse theme acceptance tests. See [validation guidance](docs/VALIDATION.md). Verify the actual colours, icon hiding and interaction on your installed theme before general use.

## Licence

MIT. See [LICENSE](LICENSE).
