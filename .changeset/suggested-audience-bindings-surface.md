---
"@objectstack/plugin-security": minor
"@objectstack/runtime": minor
"@objectstack/rest": minor
---

ADR-0090 D5/D9 — suggested audience bindings become a queryable, confirmable surface.

A package permission set declaring `isDefault: true` is an install-time
SUGGESTION to bind the set to the built-in `everyone` position — never
auto-bound. Until now the flag was only read at bootstrap as the fallback-set
name; after an install there was no way to see or act on the suggestion.

**`@objectstack/plugin-security`**: new `sys_audience_binding_suggestion`
system object (read-only over the data API; unique per
package × set × anchor) plus a convergent reconciler
(`syncAudienceBindingSuggestions`) that reads every declared `isDefault` set —
boot-declared stack metadata AND installed package manifests, so a runtime
`POST /api/v1/packages` install is visible immediately — and keeps the table
honest: undeclared → pending row pruned, bound out-of-band → marked
`confirmed` (observed). The `security` service gains
`listAudienceBindingSuggestions` / `confirmAudienceBindingSuggestion` /
`dismissAudienceBindingSuggestion`, all pre-gated on tenant-level admin
(ADR-0066 superuser wildcard — anchors stay tenant-level only per D12).
Confirm writes the `sys_position_permission_set` row **with the caller's
execution context**, so the D5/D9 audience-anchor gate (no high-privilege
set on `everyone`/`guest`) and the D12 delegated-admin gate enforce the
binding; a set not yet materialized (installed this session) is first
seeded through the same provenance-checked upsert as the boot seeder
(ADR-0086 D4).

**`@objectstack/rest`** and **`@objectstack/runtime`**: the HTTP surface,
registered on both API layers (the RestServer that `objectstack dev`/hono
serves, and the runtime HttpDispatcher used by the adapters) —
`GET /api/v1/security/suggested-bindings?status=&packageId=`,
`POST /api/v1/security/suggested-bindings/:id/confirm`,
`POST /api/v1/security/suggested-bindings/:id/dismiss` (401 unauthenticated,
403/404/409 mapped from the service's typed errors, 501/503 without
plugin-security).
