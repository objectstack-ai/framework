---
"@objectstack/service-messaging": patch
---

fix(messaging): store outbox audit timestamps as datetime so Postgres retention works

`created_at`/`updated_at` are builtin audit columns that the SQL driver always
provisions as native `TIMESTAMP` columns, regardless of the declared field type.
The notification and HTTP outboxes declared them as `Field.number` and wrote
epoch-ms via `Date.now()`, so on Postgres both the `enqueue` insert and the
retention sweep failed with `date/time field value out of range` (a bigint
compared to a timestamp column). SQLite's lenient column affinity hid the bug
until the multi-node Postgres E2E.

The outbox objects now declare these as `Field.datetime` and write `Date`s; the
retention sweep uses one ISO-8601 cutoff for every target (dropping the
`format: 'epoch'` special case); `toRecord` normalises read-back to epoch ms so
the record contract is unchanged. `sys_job_run` retention was already ISO.
