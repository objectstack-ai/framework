---
"@objectstack/service-messaging": minor
"@objectstack/platform-objects": minor
"@objectstack/plugin-audit": minor
"@objectstack/service-automation": minor
"@objectstack/metadata": minor
"@objectstack/cli": patch
"@objectstack/runtime": patch
---

ADR-0030 P0 (framework) — converge notifications onto a single ingress and the
layered model. Every producer now publishes through
`NotificationService.emit(EmitInput)`; the in-app inbox is a materialization of
delivery, not a row producers write.

**Single ingress (`@objectstack/service-messaging`) — breaking**
- `MessagingService.emit` takes the new `EmitInput` contract (`topic` /
  `audience` / `payload` / `severity` / `dedupKey` / `source` / `actorId` /
  `organizationId` / `channels`) instead of the flat `Notification` shape. It
  writes the L2 `sys_notification` event (idempotent on `dedupKey`), resolves the
  audience, then fans out; it returns `{ notificationId, deduped, deliveries,
  delivered, failed }`.
- New `sys_notification_receipt` object — the read-state spine
  (`delivered|read|clicked|dismissed`), keyed `(notification_id, user_id,
  channel)`. The inbox channel writes a `delivered` receipt on materialization.
- `sys_inbox_message`: adds `notification_id` / `delivery_id`, **drops `read`**
  (read-state moved to the receipt), adds the user `mine` list view.

**Event re-model (`@objectstack/platform-objects`) — breaking**
- `sys_notification` is re-modeled from a per-user inbox into the L2 **event**
  (`topic`, `payload`, `severity`, `dedup_key`, `source_*`, `actor_id`). Removes
  `recipient_id` / `is_read` / `read_at` / `type` / `title` / `body` / `url` /
  `actor_name` and the inbox actions/views. App-nav: the account inbox points at
  `sys_inbox_message`; Setup shows the notification event log.

**Producers routed through `emit()`**
- `@objectstack/service-automation`: the `notify` node maps its config to
  `EmitInput`.
- `@objectstack/plugin-audit`: collaboration `@mention` → `collab.mention` and
  assignment → `collab.assignment` (both with a `dedupKey`); no more direct
  `sys_notification` writes. Collaboration notifications now require
  `MessagingServicePlugin` (they degrade to a warn otherwise).

**Migration (`@objectstack/metadata`)**
- Idempotent `migrateSysNotificationToEvent` splits legacy `sys_notification`
  inbox rows into `sys_inbox_message` + receipts and rewrites the event row.

**Startup (`@objectstack/cli`, `@objectstack/runtime`)**
- `messaging` is now a foundational capability. On `objectstack serve` it is
  added to `ALWAYS_ON_CAPABILITIES` (every non-`minimal` preset starts it); on
  cloud per-project kernels the capability loader expands `requires` to add
  `messaging` whenever `audit` is present. This keeps collaboration `@mention` /
  assignment notifications (which now flow through the pipeline) working out of
  the box on both paths. `--preset minimal` opts out.

The Console bell repoint (objectui) and phases P1–P3 are tracked in
`docs/handoff/adr-0030-notification-convergence.md`.
