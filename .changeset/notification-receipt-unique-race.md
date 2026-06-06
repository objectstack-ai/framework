---
'@objectstack/service-messaging': patch
---

fix(messaging): converge mark-read receipt on unique-index race

`markRead`'s `upsertReadReceipt` did `findOne`-then-`insert` (check-then-act), so
a concurrent mark-read — or the best-effort `delivered` receipt write still in
flight — could win the `UNIQUE(notification_id, user_id, channel)` index between
the read and the write. Clicking a notification then threw
`UNIQUE constraint failed: sys_notification_receipt...`. The insert now catches a
unique violation and falls back to flipping the now-present row to `read`, with a
cross-driver `isUniqueViolation` helper (SQLite / Postgres `23505` /
MySQL `ER_DUP_ENTRY`).
