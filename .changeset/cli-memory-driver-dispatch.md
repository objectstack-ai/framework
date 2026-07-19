---
'@objectstack/cli': patch
---

fix(cli): honor `OS_DATABASE_DRIVER=memory` (mingo InMemoryDriver) (#3276)

`os dev` / `os start` / `os serve` advertised a `memory` database driver
(`--database-driver memory`, `OS_DATABASE_DRIVER=memory`, and a `memory://`
URL scheme), but `serve.ts`'s driver dispatch had no `memory` branch — so it
silently fell through to the dev SQLite `:memory:` default (SQLite-in-memory,
a *different* engine) or, in production, registered no driver at all.

The driver kind-resolution + construction is now extracted into
`utils/storage-driver.ts` (unit-testable in isolation) with the missing
`memory` branch: selecting it yields the mingo `InMemoryDriver` in dev AND
production. The `memory://` / `mingo://` URL scheme is now recognized too,
kept distinct from sqlite's `:memory:` pseudo-file. Telemetry-datasource
provisioning behavior is unchanged.
