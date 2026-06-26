---
'@objectstack/driver-sql': patch
---

Fix: store SQLite `created_at`/`updated_at` in one canonical, timezone-explicit format (ADR-0074)

The two SQLite write paths disagreed on the audit-timestamp format. INSERT fell
back to the column default `CURRENT_TIMESTAMP` (`'YYYY-MM-DD HH:MM:SS'`) while
UPDATE stamped `toISOString().replace('T',' ').replace('Z','')`
(`'YYYY-MM-DD HH:MM:SS.mmm'`) — both **timezone-naive**, space-separated strings
that `Date.parse` reads as *local* time. On a non-UTC runtime a stored UTC
wall-clock silently shifted by the host offset; e.g. the objectos kernel
freshness probe compared a shifted `updated_at` against an absolute `builtAtMs`
and never evicted (publishes/installs/config toggles didn't take effect until the
LRU TTL expired).

`create` / `bulkCreate` / `upsert` / `update` now stamp a single canonical
ISO-8601 instant with an explicit `Z` (`new Date().toISOString()`) — matching the
caller-stamped paths (`sys_metadata`, the service outboxes) and Postgres/MySQL's
native `now()`. Because the stamp is applied app-side (not via the column
default), **existing** tenant databases are fixed immediately, not just freshly
created tables. `formatOutput` additionally repairs any legacy/raw zone-naive
audit timestamp to the same format on read (idempotent), so old rows read back
unambiguously without a data migration. `upsert` now treats `created_at` as
insert-only — a conflicting merge never overwrites it.

Postgres/MySQL are unaffected (they store a real zone-aware `TIMESTAMP`).
