---
"@objectstack/service-messaging": minor
"@objectstack/service-automation": minor
---

feat(P1-2): messaging retention default-on; automation log cap configurable

Closes the remaining two P1-2 unbounded-growth items (launch-readiness):

- **service-messaging** — notification-pipeline retention is now **default-on**.
  `MessagingServicePlugin`'s `retentionDays` defaults to
  `DEFAULT_NOTIFICATION_RETENTION_DAYS` (90) instead of `0`; the
  already-built/tested sweeper now prunes `sys_notification` (+ delivery / inbox /
  receipt) older than 90 days by default. **Behaviour change:** notification
  history auto-prunes at 90d — set `retentionDays: 0` to keep it forever.
- **service-automation** — the in-memory execution-log ring buffer (already
  bounded; no OOM risk) gets a tunable window via
  `AutomationServicePluginOptions.maxLogSize`, defaulting to
  `DEFAULT_MAX_EXECUTION_LOG_SIZE` (1000, unchanged). Durable
  `sys_automation_run`-style persistence remains a post-GA HA item.
