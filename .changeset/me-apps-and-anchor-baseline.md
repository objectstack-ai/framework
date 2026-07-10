---
"@objectstack/plugin-hono-server": patch
"@objectstack/plugin-security": minor
"@objectstack/spec": minor
---

Two ADR-0090 D5 closures (#2752, #2753):

**`GET /me/apps` sources the engine registry.** Stack apps are registered
into the engine registry (runtime AppPlugin), not the metadata service —
`metadata.list('app')` returned `[]` for every principal, leaving
`tabPermissions` and `AppSchema.requiredPermissions` with no enforced
consumer. The endpoint now reads `registry.getAllApps()` (same authority as
the meta routes, nav contributions merged) with the metadata service as an
additive fallback; the capability and tab filters are unchanged and now
actually run.

**The default baseline binds to the `everyone` anchor.** `member_default`
carried `allowDelete` on its `'*'` grant — an anchor-forbidden bit — so
bootstrap refused the `everyone` binding on every boot and the baseline
flowed only through the separate fallback channel D5 explicitly rejected.
Two aligned changes:

- `describeHighPrivilegeBits` (spec) is calibrated to the exact ADR-0090 D5
  bit list (VAMA, delete/purge/transfer, systemPermissions). A plain `'*'`
  wildcard is no longer high-privilege by itself; the wildcard ban moves to
  the GUEST tier where D9 specifies it (`describeAnchorForbiddenBits`).
- `member_default` drops `allowDelete` from the wildcard. **Behavior
  change:** deleting records is no longer a baseline right — members keep
  create/read/edit-own; domains that want member deletes grant them per
  object via an ordinary position-distributed set. The owner-scoped delete
  RLS stays as a narrowing defense for members who receive a delete bit
  elsewhere.

With the baseline anchor-safe, bootstrap's existing binding path succeeds:
"what new users get" is now literally "what is bound to `everyone`" — same
table, same audit, same explain path (proven by the new
`me-apps-and-everyone-baseline` dogfood).
