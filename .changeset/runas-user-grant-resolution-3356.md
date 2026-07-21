---
"@objectstack/core": minor
"@objectstack/service-automation": minor
"@objectstack/trigger-record-change": patch
---

fix(service-automation): `runAs:'user'` runs data ops with the triggering user's
real permission sets + positions, not a bare member fallback (#3356, follow-up to
#1888)

Since #1888 the automation engine honours `flow.runAs` (`system` elevates), but
the `runAs:'user'` credential propagation was hollow. A record-change-triggered
`runAs:'user'` flow ran its data nodes (`update_record`, …) with a **zero-grant**
principal — only the `member`/`everyone` baseline — even when the triggering user
was fully authorized. Two faces by object config: a `private` object 403'd the
in-flow write (`not permitted for positions [org_member, everyone]` — the user's
permission sets were invisible); a `public_read_write` object let the write
through but **silently stripped** readonly/FLS-gated fields. The root cause: the
ObjectQL record-change hook session carries only a `userId` — never the writer's
positions/permission sets — and nothing in between resolved them, so the comment
promising "enforces RLS exactly as the user who made the change" never held.

The fix resolves the triggering user's **actual** authorization at run setup, from
the same tables a direct REST request resolves through:

- **`@objectstack/core`** factors the userId-driven core of `resolveAuthzContext`
  into a new exported `resolveUserAuthzGrants(ql, userId, opts)` — the single place
  that reads `sys_member` / `sys_user_position` / `sys_*_permission_set` and
  derives positions, permission-set names, `platform_admin`, and posture. The
  HTTP resolver now delegates to it (behaviour byte-identical; the full contract
  suite still passes), so a non-HTTP surface that already knows the user id builds
  the SAME envelope instead of re-implementing the reads.
- **`@objectstack/service-automation`** gains `AutomationEngine.setUserGrantsResolver`,
  wired by the plugin to `resolveUserAuthzGrants` over the objectql/data engine.
  For a `runAs:'user'` run whose trigger left the authz envelope unresolved (no
  `permissions`), the engine now resolves the user's positions + permission sets
  once at run setup and threads them into every data node's ObjectQL context —
  so the run enforces RLS/FLS exactly as that user. Contexts that already carry
  `permissions` are left untouched (a REST trigger, and notably an ADR-0090 agent
  ceiling acting on-behalf-of a user — always non-empty — so a deliberately
  narrowed identity is never re-broadened). `runAs:'system'` is unchanged, and a
  resolver error fails safe (warns, keeps the bare user — never elevates).
- **`@objectstack/trigger-record-change`** stops forwarding the misleading
  half-populated `positions` (empty in practice, and never `permissions`) from the
  hook session; it forwards `userId` + tenant only and lets the engine resolve the
  full grants authoritatively.

When no ObjectQL engine is present (bare engine / tests) the resolver is unwired
and run identity is unchanged from before.
