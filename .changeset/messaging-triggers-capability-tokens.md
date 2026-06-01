---
"@objectstack/service-messaging": minor
"@objectstack/cli": minor
"@objectstack/runtime": minor
---

Messaging + triggers capability tokens, and notify-by-email recipient resolution.

Make the `notify` flow node and auto-firing flows usable from a plain
`defineStack({ requires: [...] })` — no hand-wired plugin instances.

- **CLI / runtime — new capability tokens.** `messaging` →
  `MessagingServicePlugin` (the `notify` node delivers to the inbox channel
  instead of degrading to a logged no-op); `triggers` →
  `RecordChangeTriggerPlugin` + `ScheduleTriggerPlugin` (autolaunched / schedule
  flows actually fire — pair `triggers` with `job` for cron/interval). Wired
  identically in the CLI `CAPABILITY_PROVIDERS` table and the runtime
  `capability-loader`.
- **Inbox channel — notify-by-email.** Flows commonly address recipients by
  email (e.g. `{record.assignee}`), but `sys_inbox_message` is keyed by user id.
  The inbox channel now resolves an email-shaped recipient to its `sys_user.id`
  (configurable via `InboxChannelOptions.userObject`), with a verbatim fallback
  when the recipient is not email-shaped, no user matches, or the lookup fails —
  so a failed resolution can never drop the row.
