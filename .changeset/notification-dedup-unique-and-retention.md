---
"@objectstack/service-messaging": minor
"@objectstack/platform-objects": patch
---

Harden the notification pipeline: race-safe dedup + opt-in retention (ADR-0030).

**Race-safe dedup.** `sys_notification.dedup_key` is now declared a **UNIQUE**
index (was a plain index), and `emit()` **converges on a unique-key conflict**:
the pre-insert `dedup_key` check is a fast-path, but if a concurrent `emit`
raced past it and inserted first, our insert hits the violation — we catch it
and converge to the winner's event (a dedup hit) instead of throwing or
double-emitting. This mirrors the delivery outbox's enqueue convergence and
stops a record-change storm from producing duplicate bell notifications. SQL
treats NULLs as distinct, so the common events with no `dedup_key` are
unconstrained. (Enforcement is per-driver: where declared indexes are
materialized the conflict path activates; drivers that don't materialize them
fall back to the best-effort fast-path — the catch is simply never taken. Note
the SQL driver currently doesn't sync declared object indexes, which already
affects the delivery/receipt unique indexes — tracked separately.)

**Opt-in retention.** New `NotificationRetention` sweeper + plugin options
`retentionDays` / `retentionSweepMs`. Every `emit()` writes a `sys_notification`
event (plus delivery/materialization/receipt rows), so a high-frequency
periodic flow grows the tables unbounded. When `retentionDays > 0`, a
low-frequency sweep (default hourly, timer `unref`'d) bulk-deletes events,
deliveries, inbox messages and receipts older than the cutoff — a notification
ages out wholesale, keeping the model consistent (no dangling `notification_id`)
and the bell (recent-only) unaffected. The delivery row's epoch-ms `created_at`
vs the others' ISO `created_at` is handled per target. **Default off** — no
notification data is deleted without explicit operator policy. Each target is
isolated (one object's failure doesn't abort the sweep), and the sweep runs
under a system context (retention is a cross-tenant operator policy).

Tests: +7 `service-messaging` cases (converge-on-conflict, non-conflict
rethrow, retention cutoff-formatting per target, no-engine / non-positive
no-ops, failure isolation, missing-count) — 102 passing.
