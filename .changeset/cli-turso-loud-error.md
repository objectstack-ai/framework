---
'@objectstack/cli': patch
---

fix(cli): fail loudly when `turso`/libSQL is selected in the open-core CLI (#3276 follow-up)

Same "declared ≠ enforced" class as the `memory` fix: the CLI advertised `turso`
(`--database-driver turso`, `OS_DATABASE_DRIVER=turso`, `libsql://` URLs) but the
driver dispatch had no `turso` branch, so it silently fell through to the SQLite
default and ignored the requested engine.

`turso`/libSQL ships in the cloud / enterprise distribution
(`@objectstack/driver-turso`, composed by the cloud runtime's own kernel factory —
open-core's standalone stack deliberately does not consume it). Rather than pull an
EE driver into open-core, `createStorageDriver` now throws a typed
`UnsupportedDriverError` for `turso`/`libsql`, and `serve.ts` surfaces it as a
fatal, actionable boot error (naming the cloud/EE package and the open-core
alternatives) instead of silently degrading to SQLite. `libsql://` / `*.turso.*`
URLs stay classified as `turso` so they hit the same loud failure.
