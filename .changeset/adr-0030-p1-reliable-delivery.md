---
"@objectstack/service-messaging": minor
---

ADR-0030 P1 — reliable delivery + RecipientResolver.

**RecipientResolver** — the single home for audience → user-id expansion, wired
into `MessagingService.emit()`. Queries the same identity/membership model
`plugin-sharing` uses (directly via the data engine, no backward plugin
dependency):
- `role:<name>` → `sys_member` rows (tenant-scoped)
- `team:<id>` → `sys_team_member` rows
- `owner_of:<obj>:<id>` / `{ ownerOf }` → the record's owner/assignee field
- `<email>` → `sys_user` (verbatim fallback on miss); `user:<id>` / bare id → id

Best-effort: a failed directory lookup yields 0 recipients for that spec rather
than throwing. The inbox channel's email→id fallback moved here — the channel
now keys rows by the already-resolved recipient.

**Reliable delivery outbox + dispatcher** (mirrors `plugin-webhooks`):
- New `sys_notification_delivery` outbox object (L4) — one row per
  `(event × recipient × channel)`; `pending|in_flight|success|failed|dead|suppressed`
  state machine; unique `(notification_id, recipient_id, channel)` enqueue dedup.
- `INotificationOutbox` with `SqlNotificationOutbox` + `MemoryNotificationOutbox`
  backends; atomic claim (`pending → in_flight`) + stale-in_flight reaping.
- `NotificationDispatcher` — interval loop over partitions, each guarded by a
  per-partition cluster lock (single-node always-grant fallback when no cluster
  service); sends via the channel and acks with exponential backoff + jitter;
  dead-letters once the retry budget is exhausted.
- `emit()` enqueues `pending` deliveries when an outbox is attached; otherwise it
  fans out inline (the P0 behavior). `MessagingServicePlugin` wires the outbox +
  dispatcher at `kernel:ready` and registers the new object.

A failed channel send now retries and is observable on the delivery row;
duplicate enqueue is idempotent. Backoff/classification and clocks are injectable
for deterministic tests.
