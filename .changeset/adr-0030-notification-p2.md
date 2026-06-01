---
"@objectstack/service-messaging": minor
---

ADR-0030 P2 — subscription + preference. Adds the Layer-3 preference filter so
users can mute notification topics/channels, with admin-global defaults and
mandatory-topic bypass.

- **`sys_notification_preference`** — per `(user_id, topic, channel)` toggle
  (`enabled`, plus `digest`/`quiet_hours` for P3). `user_id='*'` rows are the
  admin-global default; a real-user row overrides it; `topic`/`channel` support
  `*` wildcards. Unique `(user_id, topic, channel)`.
- **`sys_notification_subscription`** — standing subscription of a principal
  (`role:`/`team:`/`user:`/id) to a topic (the opt-in counterpart to explicit
  audience; object + schema land now, subscription-driven fan-out is a follow-up).
- **`PreferenceResolver`** — wired into `MessagingService.emit()` between
  recipient resolution and fan-out/enqueue. Most-specific-wins resolution
  (user→`*`, topic→`*`, channel→`*`; default ON). Two safety rules: **mandatory
  topics bypass** (configurable via `mandatoryTopics`, exact or `prefix.`), and
  **fail-open** (no data engine or a lookup error delivers all, never silently
  drops). `emit()` now filters the `(recipient × channel)` matrix per user.
- Both objects are registered by `MessagingServicePlugin` and contributed to the
  Setup app's Configuration nav slot (ADR-0029 D7), so they appear in
  REST/Studio only when messaging is installed.

Acceptance: a user muting a topic/channel stops receiving it on that channel;
mandatory topics still deliver. service-messaging suite: 66 passing
(adds `preference-resolver.test.ts` + an emit-level mute/bypass test).
