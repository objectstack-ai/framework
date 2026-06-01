---
"@objectstack/cli": minor
---

`objectstack dev` now defaults to SQLite and auto-seeds an admin.

- **Default driver → SQLite.** With no `OS_DATABASE_URL`/`OS_DATABASE_DRIVER`,
  dev now prefers `SqlDriver(sqlite, :memory:)` over the pure-JS `InMemoryDriver`
  for production-like SQL semantics. It probes by opening a connection (knex
  loads `better-sqlite3` lazily at first query) and falls back to
  `InMemoryDriver` **with a warning** if the native binary is unavailable —
  closing a hole where the surrounding silent catch could leave the kernel with
  no driver.
- **`--seed-admin` defaults ON in dev.** Idempotent and non-destructive: POSTs
  the public sign-up endpoint, creating `admin@objectos.ai` only on an empty DB
  (then promoted to platform admin) and skipping when the email already exists
  (422/400), so a custom password is never overwritten. Disable with
  `--no-seed-admin`.
