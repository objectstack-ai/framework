---
"@objectstack/spec": minor
"@objectstack/plugin-security": minor
---

ADR-0058 D1 follow-through — RLS predicates are now canonical CEL. Migrated every
seeded RLS `using`/`check` (default permission sets, showcase, and the
`RLS.ownerPolicy`/`tenantPolicy`/`allowAllPolicy` helper factories) from the
legacy SQL-ish form (`=`, `IN (...)`) to pure CEL (`==`, `in`), so authors and AI
learn ONE expression language. The `sqlPredicateToCel` bridge is retained as a
DEPRECATED transitional shim: a stored SQL-style predicate still compiles (no
silent deny on legacy data) but emits a deprecation warn; canonical CEL passes
through as a no-op. No runtime behavior change — CEL and the old SQL form compile
to the identical FilterCondition.
