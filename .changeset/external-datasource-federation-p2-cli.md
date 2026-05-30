---
"@objectstack/cli": minor
---

External Datasource Federation (ADR-0015) — CLI surface.

New `os datasource` command group: `list-tables` (list remote tables),
`introspect` (generate a reviewable `*.object.ts` draft from a remote table),
and `validate` (validate federated objects against the remote schema; exits
non-zero on mismatch). Backed by the `/api/v1/datasources/:name/external/*`
REST routes.
