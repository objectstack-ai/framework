# ADR-0030 — Notification Platform Convergence (single ingress, layered pipeline)

**Status**: Proposed (2026-06-01)
**Supersedes / refines**: [ADR-0012 — Notification Platform](./0012-notification-platform.md) (Draft)
**Related**: [ADR-0019 — Approval as a Flow Node](./0019-approval-as-flow-node.md), [ADR-0022 — Connectors vs Messaging Channels](./0022-connectors-vs-messaging-channels.md)
**Build spec**: [docs/design/notification-platform-convergence.md](../design/notification-platform-convergence.md)

## Context — the drift

ADR-0012 proposed a correct 5-layer notification platform (Event → Notification → Subscription/Preference → Delivery/Outbox → Inbox/Receipt). Only **M1-minimal** shipped, and it **drifted** from the design. Verified state (2026-06-01):

- **Two objects both act as a per-user in-app inbox, and they don't connect.**
  - `sys_notification` (platform-objects): `recipient_id` (lookup user), `type`, `title`, `body`, `source_object/id`, `url`, `actor_id/name`, `is_read`, `read_at`. **Written directly** by the collaboration/audit plugin (`@mention`, assignment). **Read** by the Console bell / notification center (objectui `AppHeader`, `InboxPopover`). This is the *de-facto* inbox — but it is **not** ADR-0012's Layer-2 event (it has no `topic`/`payload`/`dedup_key`/`severity`).
  - `sys_inbox_message` (service-messaging): `user_id`, `topic`, `title`, `body_md`, `severity`, `action_url`, `read`. **Written** by the `notify` flow node → `MessagingService.emit` → inbox channel. **Read by nothing** — zero readers across framework and objectui (confirmed by grep).
- Net effect: `notify`-based flows (and any future channel) never reach the UI bell; collaboration notifications never flow through any pipeline.
- The ADR's middle layers (delivery outbox, subscription/preference, templates, receipts) were **never built**.

Root principle that was violated: **producers write per-user inbox rows directly, with no single ingress and no pipeline.**

## Decision

Do **not** merge the two tables into one. **Un-conflate** them back into the ADR-0012 layered model and realize the pipeline, governed by one rule:

> **Single ingress.** Every notification producer — the flow `notify` node, collaboration `@mention`, record assignment, approval requests, system alerts — calls exactly one API: `NotificationService.emit({ topic, audience, payload, severity, dedupKey, source, actor })`. **No producer writes an inbox/materialization row directly.** The in-app inbox is a *materialization of delivery*, not a thing producers write.

### Target object model

| Layer | Object | Role |
|---|---|---|
| L2 Event | `sys_notification` *(re-modeled to event)* | one row per `emit`: `topic`, `payload`(json), `severity`, **`dedup_key`** (idempotency), `source_object/id`, `actor_id`, `created_at`. **No recipient, no read-state.** |
| L3 Resolve + Preference | `sys_notification_subscription`, `sys_notification_preference` | audience expansion (`role:` / `owner_of:record` / `team:` / explicit ids; **email→id resolved here**), user×topic×channel toggles, quiet-hours, digest; mandatory topics bypass |
| L4 Delivery (outbox) | `sys_notification_delivery` | one row per (event × recipient × channel); state machine `pending→sent→failed/dead`; retry/backoff/dedup; the durable spine |
| L5 Materialize + Receipt | `sys_inbox_message` (in-app), `sys_email`, `sys_user_device` (push), connector dispatch (webhook/Slack); `sys_notification_receipt` | each channel renders delivery into a consumable artifact; **the bell reads `sys_inbox_message`**; read/clicked/dismissed live in `sys_notification_receipt` |
| Cross-cutting | `sys_notification_template` (topic×channel×locale) | rendering, with generic fallback to `title`/`body` |

The in-app inbox is **one channel among peers** (email/push/webhook). The architecture treats channels as plugins on connectors (ADR-0022) from day one, even when only the inbox channel is implemented, so the seams don't grow crooked again.

### Resolved design decisions (per architect recommendation — confirm before P0)

1. **`sys_notification` → rename/re-model to the event in place, with data migration** (one-step, no lingering deprecated table) rather than introducing a parallel `sys_notification_event`. Its inbox semantics move down: recipient/read → `sys_inbox_message` + receipt; `actor`/`source` → event columns/payload.
2. **Read-state lives in `sys_notification_receipt`** (per recipient×channel), not on `sys_inbox_message` — so cross-channel read semantics ("clicked the email → mark inbox read") are reachable later.
3. **Audience resolution reuses the platform's existing expression/sharing resolver** (`role:` / `owner_of:` …) rather than a bespoke notifications resolver.
4. **Preference model**: admin-set global defaults + per-user override + mandatory topics that bypass preferences.
5. **`sys_inbox_message` is retained** as the L5 in-app materialization (it is already correct for that role).

### Low-code platform requirements this unlocks

- Declarative topic catalog via `defineTopic()` — app builders register notification types as **metadata**.
- Per-user notification **preferences UI** (user×topic×channel) and **templates** become first-class, Studio-configurable objects.
- Reliable delivery (outbox + retry + `dedup_key`) survives record-change storms.
- Multi-channel (in-app, email, push, webhook, Slack/Teams) without re-plumbing.

## Phased delivery (each phase is correct-by-construction, not a stopgap)

P0 establishes the correct seams; later phases only add layers — no rework.

- **P0 — Seams**: extract `emit()` single ingress; route `notify` + collaboration through it; UI bell reads `sys_inbox_message`; re-model `sys_notification` to the event (with migration). *Outcome: the bell lights up for all sources and the model is correct.*
- **P1 — Reliable delivery**: `sys_notification_delivery` outbox + retry/dedup; `RecipientResolver` owns recipient/email resolution (move the channel-level email→id fallback up here).
- **P2 — Subscription + preference**: preference objects + Studio config UI + mandatory topics.
- **P3 — Channels + templates + digest**: email/push/webhook channels, `sys_notification_template`, digest / quiet-hours middleware.

Acceptance criteria per phase live in the build spec.

## Consequences

- **Positive**: one governed ingress; the bell reflects every producer; reliability, preferences, multi-channel, templates all become reachable incrementally; matches mature notification platforms and low-code expectations.
- **Cost**: P0 spans framework + objectui (UI bell re-points to `sys_inbox_message`) and requires a `sys_notification` data migration. This is a multi-phase investment (ADR-0012 already flagged the full platform as such).
- **ADR-0012** is marked superseded by this ADR; its 5-layer model is retained and realized, not discarded.
