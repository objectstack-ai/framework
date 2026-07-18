---
"@objectstack/plugin-auth": patch
---

fix(plugin-auth): run better-auth adapter WRITES as system context so #2948 doesn't strip readonly identity columns (#3164)

The better-auth ObjectQL adapter wrapped the engine so its READS carried
`isSystem` (to bypass the control-plane org-scope read hook), but its WRITES
passed through with no context. The static-`readonly` UPDATE strip (#2948) runs
on any non-system update — and since the adapter carries no caller context,
`!ctx?.isSystem` was `true`, so the strip silently DROPPED better-auth's own
writes to readonly `sys_user` columns: `email` (change-email), `banned` /
`ban_reason` / `ban_expires` (admin ban). Those operations returned success but
never persisted.

`withSystemReadContext` is renamed to `withSystemContext` (a deprecated alias is
kept for one release) and now injects `isSystem` on `insert` / `update` /
`delete` as well as reads. This is correct because these are the identity
authority's own writes — user-context writes to `managedBy: 'better-auth'` tables
are already rejected upstream by the ADR-0092 identity write guard, so the
adapter path only ever carries better-auth's internal writes.

Found while implementing #3043 (the INSERT-side readonly strip). This is its
UPDATE-side dual: #3043 relocated the insert strip to the external ingress
precisely because internal writers (this adapter included) don't declare
`isSystem`; the pre-existing engine-level UPDATE strip has no such relocation, so
the adapter had to declare its writes system.
