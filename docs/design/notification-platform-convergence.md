# Design / Build Spec — Notification Platform Convergence

**Decision**: [ADR-0030 — Notification Platform Convergence](../adr/0030-notification-platform-convergence.md)
**Refines/realizes**: [ADR-0012](../adr/0012-notification-platform.md) · **Channels on connectors**: [ADR-0022](../adr/0022-connectors-vs-messaging-channels.md)
**Audience**: the implementing agent. This is the executable spec; ADR-0030 holds the *why*.

> **Status (2026-06-01):** P0, P1, P2, P3a, and **P3b-1 (quiet-hours) are shipped**
> (PRs #1434/#1441/#1444/#1449/#1453). The §4 checklists below are the original
> plan — for the current done/remaining breakdown see
> [ADR-0030 § Implementation status & remaining work](../adr/0030-notification-platform-convergence.md#implementation-status--remaining-work)
> and [docs/handoff/adr-0030-notification-convergence.md](../handoff/adr-0030-notification-convergence.md).
> **Remaining:** P3b-2 (digest), the cross-repo objectui bell cut-over +
> mark-read write path, and the incremental channels / hardening items.

---

## 0. The governing rule

> **Single ingress.** Every producer calls `NotificationService.emit(...)`. **No producer writes a per-user inbox/materialization row directly.** The in-app inbox is a *materialization of delivery*.

Current violations to remove:
- `plugin-audit/src/audit-writers.ts` writes `sys_notification` directly (`@mention`, assignment) — re-route to `emit()`.
- `service-messaging` inbox channel writes `sys_inbox_message` directly from the `notify` node — keep the channel, but it must run **after** the pipeline (event → resolve → deliver), not as the producer.

---

## 1. Current state (verified 2026-06-01)

| Object | Owner | Fields | Written by | Read by |
|---|---|---|---|---|
| `sys_notification` | platform-objects | `recipient_id`,`type`,`title`,`body`,`source_object/id`,`url`,`actor_id/name`,`is_read`,`read_at` | collaboration/audit (direct) | Console bell (objectui `AppHeader`/`InboxPopover`/`RecordDetailView`) |
| `sys_inbox_message` | service-messaging | `user_id`,`topic`,`title`,`body_md`,`severity`,`action_url`,`read` | `notify` node → `MessagingService.emit` → inbox channel | **nothing** (0 readers) |

The shipped `sys_notification` is mis-modeled: it is a per-user *inbox*, not ADR-0012's Layer-2 *event* (no `topic`/`payload`/`dedup_key`/`severity`).

---

## 2. Target object model (schemas)

> Names follow ADR-0012. Owners: events/delivery/preference/template/receipt → `service-messaging`; `sys_inbox_message` stays in `service-messaging`. `sys_user_device`/`sys_email` per their channel plugins.

**L2 `sys_notification` (re-modeled → event; one row per `emit`)**
- `id`, `topic` (text, indexed), `payload` (json), `severity` (info|warning|critical), `dedup_key` (text, unique-ish per topic+window, nullable), `source_object`, `source_id`, `actor_id` (lookup sys_user, nullable), `organization_id`, `created_at`.
- Remove: `recipient_id`, `is_read`, `read_at`, `type`, `actor_name`, `url`, `title`, `body` (move title/body into templates or payload; actor_name derivable from actor_id).
- Index: `(topic, created_at)`, `(dedup_key)`.

**L3 `sys_notification_subscription`** — who is subscribed to a topic (system-wide / role / explicit). `id`, `topic`, `principal` (`role:x`/`user:id`/`team:x`), `created_at`.
**L3 `sys_notification_preference`** — `id`, `user_id`, `topic`, `channel`, `enabled` (bool), `digest` (none|daily|weekly), `quiet_hours` (json), unique `(user_id, topic, channel)`. Mandatory topics bypass.

**L4 `sys_notification_delivery` (outbox)** — `id`, `notification_id` (FK L2), `recipient_id` (sys_user), `channel`, `status` (pending|in_flight|success|failed|dead|suppressed), `attempts`, `next_attempt_at`, `partition_key`, `error`, `created_at`, `updated_at`. Indexes: `(status, next_attempt_at)`, `(notification_id)`.

**L5 materialization**
- `sys_inbox_message` (in-app channel output) — **keep**. `id`, `user_id`, `notification_id` (FK), `delivery_id` (FK), `topic`, `title`, `body_md`, `severity`, `action_url`, `created_at`. (Drop `read` — read-state moves to receipt; see §Decisions.)
- `sys_email` (email log), `sys_user_device` (push tokens) — later phases.
**L5 `sys_notification_receipt`** — `id`, `delivery_id` (FK) or `(notification_id,user_id,channel)`, `state` (delivered|read|clicked|dismissed), `at`. The bell's read-state lives here.

**Cross-cutting `sys_notification_template`** — `id`, `topic`, `channel`, `locale`, `version`, `subject`/`body` (MJML for email, md/json for others), `compiled_html` (cache). Generic fallback to `payload.title`/`payload.body`.

---

## 3. `emit()` contract

```ts
interface EmitInput {
  topic: string;                       // e.g. 'task.assigned', 'collab.mention', 'project.budget_approval'
  audience: Audience;                  // role:x | owner_of:{object,id} | team:x | user ids | emails
  payload: Record<string, unknown>;    // template inputs (title/body/url/actor/source/...)
  severity?: 'info'|'warning'|'critical';
  dedupKey?: string;                   // idempotency within a topic window
  source?: { object: string; id: string };
  actorId?: string;
}
// 1) write L2 sys_notification (idempotent on dedupKey)
// 2) resolve audience → recipient user ids (RecipientResolver; email→id here)  [P1]
// 3) preference filter per (user, topic, channel); mandatory topics bypass     [P2]
// 4) write L4 sys_notification_delivery rows (pending)                          [P1]
// 5) dispatch each delivery to its channel; channel materializes (L5)
NotificationService.emit(input: EmitInput): Promise<{ notificationId: string }>;
```

Channels implement the existing `MessagingChannel` seam (ADR-0012 §2); transports sit on connectors (ADR-0022). The in-app `inbox` channel writes `sys_inbox_message` + a `delivered` receipt.

---

## 4. Phased delivery (each phase ships independently; no rework)

### P0 — Seams (framework + objectui) — **the critical first phase**
**Goal**: one ingress; UI reads the materialization; `sys_notification` becomes the event; read-state in receipt. After P0 the bell lights up for *every* producer and the model is correct.
- [ ] `service-messaging`: refactor `MessagingService.emit` to the `EmitInput` contract; write L2 `sys_notification` (event) first, then fan to channels. (P0 may resolve recipients inline; outbox is P1.)
- [ ] Re-model `sys_notification` object (`packages/platform-objects/src/audit/sys-notification.object.ts`) to the event schema (§2) + **data migration** for existing rows (split recipient/read → `sys_inbox_message` + receipt).
- [ ] Add `sys_notification_receipt` object; inbox channel writes a `delivered` receipt; mark-read updates it.
- [ ] `inbox-channel.ts`: write `sys_inbox_message` with `notification_id`; drop the local `read` flag (use receipt). Keep email→id fallback until P1.
- [ ] Re-route `plugin-audit/src/audit-writers.ts` collaboration writers → `emit(topic:'collab.mention'|'collab.assignment', audience, payload:{actor,source,title,body,url})`.
- [ ] **objectui** (`packages/app-shell/src/layout/AppHeader.tsx`, `InboxPopover.tsx`): poll `sys_inbox_message` (join receipt for read-state) instead of `sys_notification`; mark-read PATCH → receipt endpoint; "view all" route updated.
- **Acceptance**: reassign / mark-done / @mention all produce a bell entry via `emit()`; `sys_notification` rows carry no recipient/read; read toggling persists to receipt; `sys_inbox_message` has 0 direct writers besides the inbox channel.

### P1 — Reliable delivery
- [ ] `sys_notification_delivery` outbox + dispatcher (state machine, retry/backoff, dead-letter, `dedup_key`).
- [ ] `RecipientResolver` (reuse platform sharing/CEL resolver): `role:`/`owner_of:`/`team:`/ids/emails → user ids. Move inbox channel's email→id fallback here.
- **Acceptance**: a failed channel send retries and is observable on the delivery row; duplicate `emit` with same `dedupKey` is idempotent.

### P2 — Subscription + preference
- [ ] `sys_notification_subscription` + `sys_notification_preference` objects + Studio config UI; mandatory-topic bypass; defaults model (admin global + user override).
- **Acceptance**: a user muting a topic/channel stops receiving it; mandatory topics still deliver.

### P3 — Channels + templates + digest
- [ ] email/push/webhook/Slack channels on connectors (ADR-0022); `sys_notification_template` (topic×channel×locale) + renderer; digest / quiet-hours middleware.
- **Acceptance**: same `emit` reaches inbox + email per the user's prefs, rendered from a template; digest batches.

---

## 5. Open decisions (ADR-0030 recommends; confirm before P0)
1. `sys_notification` **rename/re-model in place + migration** (recommended) vs new `sys_notification_event`.
2. Read-state in **`sys_notification_receipt`** (recommended) vs on `sys_inbox_message`.
3. Audience resolution **reuses existing sharing/CEL resolver** (recommended).
4. Preference defaults: **admin global + user override + mandatory bypass** (recommended).
5. `sys_inbox_message` **retained** as L5 in-app materialization (recommended).

## 6. Risks
- P0 is cross-repo (framework + objectui) and migrates a live, UI-depended object — sequence the migration + UI cut-over carefully (ship object/back-end first behind a read that tolerates both shapes, then flip the UI).
- Don't reintroduce direct inbox writes in any producer — enforce the single-ingress rule in review.
