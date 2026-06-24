---
'@objectstack/service-automation': minor
'@objectstack/cli': minor
'@objectstack/spec': patch
'@objectstack/trigger-schedule': patch
---

fix(security): surface the schedule/user-less `runAs:'user'` fail-open (#1888 follow-up)

With `flow.runAs` now enforced (#1888), a **schedule-triggered** flow with the
default `runAs:'user'` has no trigger user. `resolveRunDataContext` returns
`undefined` for that case, so the CRUD nodes pass no ObjectQL `options.context`
and the security middleware — which *skips* when there is no identity (it
delegates auth to the auth layer) — runs the operation **UNSCOPED** (effectively
elevated). An author who left `runAs` at the `'user'` default expecting a
restricted run silently gets an unscoped one — a fail-open footgun (ADR-0049: a
security property must not silently do the opposite of what it implies).

This is the **product decision** to make that explicit, chosen to keep legitimate
scheduled CRUD working (denying outright would break it, and silently elevating
would hide the author's intent). Prevention happens where the platform can tell
intent apart (author/build time); the runtime stays non-breaking but is no longer
silent:

- **Author-time lint** (`@objectstack/cli`, `lintFlowPatterns`): a new advisory
  rule `flow-schedule-runas-unscoped` flags a schedule-triggered flow whose
  effective `runAs` is `user` (explicit or unset) and which performs a data
  operation — pointing the author at `runAs:'system'`. Catches the footgun at
  compile time, before deploy (most flows are AI-authored).
- **Runtime warning** (`@objectstack/service-automation`): the engine now emits a
  clear one-per-run warning when a user-mode run resolves no trigger identity and
  the flow touches data — the fail-open is *audible* rather than silent. Behavior
  is otherwise unchanged (the run still executes), so scheduled CRUD that relied
  on this is not broken. New helpers `runIsUnscopedUserMode`, `flowTouchesData`,
  and `DATA_NODE_TYPES` are exported alongside `resolveRunDataContext`.
- **Spec describe** (`@objectstack/spec`): `FlowSchema.runAs` now states that a
  scheduled run has no user, so under `user` it runs unscoped — declare `system`.

The first-party example apps that tripped the new lint are fixed to declare
`runAs:'system'` explicitly (`stale_opportunity_sweep`, the app-todo
`task_reminder` / `overdue_escalation` sweeps) — they read/write across owners and
were running unscoped by default.

Longer term, attributing scheduled runs to a dedicated service principal (so they
are scopable + audit-attributable rather than unscoped) is the right enforcement;
tracked as M2 follow-up.

Proven by a service-automation unit test (the engine warns once for a user-less
user-mode data run; stays silent for `system`, for an identified user, and for a
data-less flow), an end-to-end test wiring the **real `ScheduleTrigger` to the
real engine** (`@objectstack/trigger-schedule`) that fires a job and asserts the
user-less identity reaches the engine + trips the warning through the actual cron
path, and a dogfood gate (`flow-runas-schedule.dogfood.test.ts`) that drives
user-less runs through the real automation + security + data stack: a
`runAs:'user'` run reads + writes an owner-scoped note a member cannot — audibly —
while `runAs:'system'` is the explicit, warning-free equivalent.

Refs #1888, ADR-0049.
