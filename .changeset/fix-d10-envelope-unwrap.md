---
"@objectstack/rest": patch
---

Fix: the Setup-nav capability gate (`requiresService`, ADR-0057 D10) was a no-op on the single-item app-meta path.

`GET /meta/app/:name` returns a metadata envelope `{ type, name, item: <app>, ... }`, but
`filterAppForUser` was applied to the envelope — whose `.navigation` is undefined — so it
returned it untouched, silently bypassing BOTH the `requiredPermissions` gate and the D10
`requiresService` gate. Organizations/Invitations therefore still appeared in the Setup app
even in single-tenant deployments. `filterAppForUser` and `resolveRegisteredServices` now
unwrap the envelope (the list path already passed the raw app). Verified against a live
`os dev`: single-tenant hides Organizations/Invitations; multi-tenant shows them.
