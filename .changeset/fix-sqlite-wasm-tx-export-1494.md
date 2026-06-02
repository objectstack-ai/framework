---
"@objectstack/driver-sqlite-wasm": patch
---

Fix `COMMIT; - cannot commit - no transaction is active` under `persist: 'on-write'` (#1494).

sql.js's `Database.export()` closes and reopens the database (it has no in-place
serialize), which rolls back any open transaction. The fire-and-forget flush
triggered after a write inside a Knex transaction (e.g. the autonumber sequence
`BEGIN…COMMIT`) could therefore abort that transaction, leaving the trailing
`COMMIT` to fail. The connection is now transaction-aware: `flush()` is deferred
while a transaction is open and runs once it fully closes, so committed data is
still persisted without aborting in-flight transactions.
