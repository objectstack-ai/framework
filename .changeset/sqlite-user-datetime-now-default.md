---
'@objectstack/driver-sql': patch
---

Fix: canonical storage + presentation for user-declared `NOW()`-default temporal fields on SQLite (ADR-0074 follow-up)

A user-declared `Field.datetime` (or `date`/`time`) with `defaultValue: 'NOW()'`
took the `knex.fn.now()` → `CURRENT_TIMESTAMP` column default on SQLite, storing a
**timezone-naive**, space-separated `'YYYY-MM-DD HH:MM:SS'` (no millis, no zone).
`Date.parse` reads such a zone-less string as *local* time, so the stored UTC
wall-clock shifted by the host offset on a non-UTC runtime — the same class of bug
ADR-0074 fixed for the builtin `created_at`/`updated_at` audit columns, but left
scoped out for user fields. Worse, the **same** column mixed storage: an explicit
JS `Date` is bound by better-sqlite3 as INTEGER epoch ms, while an omitted value
took the naive TEXT default — so one column held both INTEGER ms and naive TEXT.

This fix, SQLite-only:

- **DDL default → canonical.** The `NOW()` default now emits a per-type canonical
  via `strftime`: datetime → ISO-8601 with explicit `Z`
  (`strftime('%Y-%m-%dT%H:%M:%fZ','now')`, e.g. `2026-06-26T10:34:13.891Z`,
  matching `new Date().toISOString()`); date → `YYYY-MM-DD`; time → `HH:MM:SS.fff`
  time-of-day (not a full timestamp).
- **Read → uniform instant.** `formatOutput` folds every `Field.datetime` storage
  form — INTEGER epoch ms, canonical ISO-`Z`, and legacy naive `CURRENT_TIMESTAMP`
  TEXT — to one canonical ISO-8601-`Z` instant (`normalizeSqliteDatetimeOutput`),
  interpreting a naive wall-clock as UTC. Idempotent on already-zone-explicit
  values; total on null/unparseable. This transparently repairs existing rows on
  read (a DDL default only governs newly-created columns), so no data migration is
  needed — mirroring the `Field.date`/numeric read-repairs already in place.

Applied as DDL-default + read-normalization, NOT app-side write stamping (the
inverse of ADR-0074's audit-column fix): the read path already repairs
existing-table rows transparently, and an explicit `Date` is bound as INTEGER
epoch ms regardless of any write stamp, so stamping wouldn't make on-disk storage
uniform anyway — the INTEGER-vs-TEXT split is inherent to SQLite and resolved at
the read boundary. This keeps the hot insert/upsert/bulk paths untouched.

The analytics SQL-bucketing path (`strftime`, bypasses `formatOutput`) is
unchanged: ISO-`Z` TEXT buckets identically to the old naive TEXT. Postgres/MySQL
keep native `now()` (a real zone-aware `TIMESTAMP`) and are entirely unaffected.

Generalizes ADR-0074's `repairNaiveUtcAuditTimestamp` by also folding the INTEGER
epoch-ms storage form; the two read-repairs can be unified once both land.
