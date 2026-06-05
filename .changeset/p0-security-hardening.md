---
'@objectstack/plugin-auth': patch
'@objectstack/plugin-security': patch
'@objectstack/driver-sql': patch
'@objectstack/driver-mongodb': patch
---

fix(security): close four P0 launch-readiness findings

- **plugin-auth (P0-1):** `generateSecret()` now throws (fails boot) when no
  `OS_AUTH_SECRET` is set and `NODE_ENV==='production'`, instead of silently
  falling back to a predictable `dev-secret-<timestamp>` (session forgery). The
  dev/test fallback is unchanged.
- **plugin-security (P0-2):** the permission-resolution `catch` now **fails
  closed** — it logs at ERROR and throws `PermissionDeniedError` rather than
  `return next()`. A degraded metadata service can no longer let every
  authenticated request bypass RBAC/RLS. System operations still bypass as before.
- **driver-sql (P0-3):** the `contains` / `$contains` operator now escapes LIKE
  metacharacters (`%` / `_` / `\`) in the user value and binds an explicit
  `ESCAPE '\'`, so a value of `%` matches literally instead of every row
  (filter bypass). Correct across SQLite/MySQL/Postgres.
- **driver-mongodb (P0-4):** the field-operator translator now rejects unknown
  `$`-operators instead of passing them through, blocking `$where` / `$function`
  / `$expr` (server-side JS execution / query-intent bypass). All legitimate
  ObjectQL operators remain allowlisted.

+12 regression tests across the four packages.
