---
'@objectstack/service-messaging': minor
---

feat(messaging): digest batching for notifications (ADR-0030 P3b-2)

Recipients can now batch a topic into a `daily` / `weekly` **digest** instead of
receiving every notification immediately. Builds on P3b-1's deferral seam:

- `PreferenceResolver` consumes the `digest` preference field and `digestDeferral()`
  defers a batched recipient to the next window (local midnight / Monday 00:00),
  tagging the target with a stable `window`. Digest takes precedence over
  quiet-hours; `critical` and mandatory topics bypass it.
- `sys_notification_delivery` gains a `digest_key` (`recipient|channel|window`).
  Batched rows partition by that key so a window's rows co-locate, and the normal
  outbox `claim()` skips them while the new `claimDigest()` drains a window whole.
- The dispatcher's digest pass collapses each `(recipient, channel, window)` group
  into one `renderDigest()` message under the existing per-partition cluster lock,
  then acks every row in the group with that single outcome.

Additive: non-digest notifications are unchanged. Timezone-from-`sys_user`,
configurable send-hour, and MJML digest emails are deferred follow-ups.
