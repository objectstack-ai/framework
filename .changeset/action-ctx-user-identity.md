---
"@objectstack/runtime": patch
---

fix(runtime): action body `ctx.user` now reflects the session operator, not `system`

The `POST /actions/:object/:action` route called `handleActions` directly,
bypassing `dispatcher.dispatch()` — so `resolveExecutionContext` never ran and
the action handler's `ctx.user` was hard-coded to `{ id: 'system' }`. Handlers
could not branch on the operator's identity or business roles, nor enforce
server-side ownership. (#2701)

- The action routes now dispatch through `dispatch()` like the automation/AI
  routes, so the per-request pipeline resolves the session identity (and swaps
  to the per-project kernel) before the action body runs.
- `handleActions` builds `ctx.user` from the resolved `ExecutionContext`,
  exposing `id`, `email`, `roles`/`positions` (ADR-0090 business roles),
  `permissions`, and `tenantId` — matching the MCP `runAction` and
  record-change trigger paths. It falls back to a `system` principal only for a
  genuinely anonymous / self-invoked call.

No authoring change is required: action handlers that previously always saw
`ctx.user.id === 'system'` will now see the real caller.
