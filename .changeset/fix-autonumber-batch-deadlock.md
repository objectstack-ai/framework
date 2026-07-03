---
'@objectstack/driver-sql': patch
---

Fix a connection-pool deadlock when the first `auto_number` write after process
start goes through a transaction (e.g. `POST /api/v1/batch`, which wraps every
operation in one `ql.transaction(...)`).

The sequence-counter table (`_objectstack_sequences`) was created lazily on the
first autonumber INSERT via a bare `this.knex.schema.*` call that asks the pool
for a second connection. On SQLite (better-sqlite3, pool max=1) the open batch
transaction already holds the only connection, so the acquire blocked until
`Knex: Timeout acquiring a connection`. Postgres/MySQL are exposed to the same
pool-exhaustion deadlock under concurrent cold first-writes.

Fixes:
- `initObjects` now pre-creates the counter table up front, outside any data
  transaction, so the first write never runs DDL (primary fix).
- The lazy fallback (`ensureSequencesTable`) now runs its DDL on the caller's own
  transaction on SQLite instead of grabbing a second connection. It deliberately
  does not route DDL through the caller's transaction on MySQL, where DDL would
  implicitly commit the caller's in-flight transaction.
