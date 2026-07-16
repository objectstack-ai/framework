---
'@objectstack/spec': minor
'@objectstack/runtime': patch
'@objectstack/plugin-auth': patch
---

fix(plugin-auth): re-run membership backfill when app seeding settles (#2996)

The ADR-0093 D6 membership backfill — the only safety net for users created
by app seeds (raw `engine.insert` into `sys_user` bypasses better-auth's
`user.create.after` reconciler) — ran only once on `kernel:ready`. When a seed
bundle overruns its inline budget (`OS_INLINE_SEED_BUDGET_MS`, default 8s) it
finishes in the background *after* `kernel:ready`, so its users stayed
member-less in single-org `auto` mode until the next restart re-ran the backfill.

`AppPlugin` now emits a new **`app:seeded`** lifecycle event when an app's inline
seed settles (success, partial, or fallback) — carrying `{ appId, overBudget }`,
where `overBudget: true` marks the post-`kernel:ready` background case. plugin-auth
subscribes and re-runs the (idempotent, self-guarding, opt-out-able)
`backfillMemberships` on that signal, closing the window without waiting for a
restart. No behavior change when a seed completes within budget, in multi-tenant
mode, or under `invite-only` policy; `OS_SKIP_MEMBERSHIP_BACKFILL=1` still opts out.
