---
"@objectstack/service-analytics": patch
"@objectstack/driver-sql": patch
"@objectstack/spec": patch
---

Fix dashboard time-series charts / "last N months" KPIs that filter or group by a `Field.datetime` column silently returning "No rows".

The analytics `NativeSQLStrategy` compiles dashboard relative-date tokens (`{12_months_ago}`, `{today}`, …) to ISO date strings and binds them directly into raw SQL, bypassing the driver's own filter coercion. Under better-sqlite3 a `Field.datetime` column is stored as an INTEGER epoch (ms), so `assessed_at >= '2025-06-18'` became a TEXT-vs-INTEGER affinity compare that is always false — an empty result even though the rows exist. `Field.date` columns store ISO TEXT and were unaffected.

The strategy now coerces a temporal comparand to the column's on-disk storage form via a new optional `StrategyContext.coerceTemporalFilterValue` hook, wired to the driver's public `SqlDriver.temporalFilterValue` (the single source of truth for the storage convention). Coercion is dialect-correct: SQLite `Field.datetime` → epoch ms; `Field.date` text and native-timestamp dialects (Postgres/MySQL) are left unchanged, so Postgres is never handed an epoch integer. Applied to `gte`/`lte`/`gt`/`lt`/`equals`, `in`/`notIn`, and the `dateRange`/timeDimension `BETWEEN` path.
