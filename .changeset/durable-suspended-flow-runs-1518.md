---
"@objectstack/service-automation": minor
---

Persist suspended flow runs so a durable pause survives a process restart (#1518).

`service-automation` kept suspended runs in an in-memory `Map` only, so a flow
paused at an `approval` / `wait` / `screen` node could never be resumed after the
process restarted — a hard blocker on hibernating/serverless hosts (e.g. the
Cloudflare Workers control plane), where the approval record persists but
`resume(runId)` had nothing to continue.

The engine now backs that map with a pluggable `SuspendedRunStore` (ADR-0019):

- **`SuspendedRunStore`** interface + two implementations — `InMemorySuspendedRunStore`
  (the default; JSON round-trips so it faithfully mirrors a DB boundary) and
  `ObjectStoreSuspendedRunStore`, which persists to a new **`sys_automation_run`**
  system object via the ObjectQL engine. `AutomationServicePlugin` registers the
  object and auto-enables the DB-backed store when an ObjectQL engine is present
  (opt out with `suspendedRunStore: 'memory'`).
- **Durable suspend/resume** — a run is persisted on suspend and deleted on
  terminal completion. `resume(runId)` rehydrates from the store when the run is
  not in memory (cold boot), so a fully restarted kernel can continue from the
  paused node down the correct branch and run the downstream nodes. The resumable
  state (`variables` / `steps` / `context` / `screen`) round-trips through the
  store, including nested objects.
- **Idempotent resume** — the suspension is consumed before downstream work runs,
  plus an in-process guard rejects a concurrent duplicate `resume`, so a repeated
  resume after a partial restart can't double-run side effects.
- Run ids are now process-unique (random component) so they don't collide with a
  still-suspended run persisted by a previous process lifetime.

New exports: `SuspendedRun`, `SuspendedRunStore`, `StepLogEntry`,
`InMemorySuspendedRunStore`, `ObjectStoreSuspendedRunStore`,
`SuspendedRunStoreEngine`, `SysAutomationRun`, plus
`AutomationEngine.setSuspendedRunStore()` and `listSuspendedRunsDurable()`.
Existing service-automation and plugin-approvals tests pass unchanged.
