---
'@objectstack/runtime': minor
'@objectstack/types': minor
---

feat(runtime): sandbox budget is script CPU-time, not wall clock (ADR-0102 D1, #3295)

The QuickJS sandbox now meters each hook/action invocation against how much
**VM-active (CPU) time** the body burns, not wall clock. Idle host-await time and
a nested hook's own execution (which runs host-side while the caller's VM is
parked) are no longer charged to the caller — so a slow/loaded host or a deep
nested-write chain can't trip the budget while a script is merely waiting (the
root cause of the #3259 CI flake). A separate, generous **wall-clock ceiling**
(default 30s, `max(ceiling, cpuBudget)`) remains as the backstop for a body stuck
on a host call that never settles.

What changes for consumers (behaviour, not API signatures):

- **Meaning of the timeout knobs.** `body.timeoutMs`, the `hookTimeoutMs` /
  `actionTimeoutMs` runner options, and `OS_SANDBOX_HOOK_TIMEOUT_MS` /
  `OS_SANDBOX_ACTION_TIMEOUT_MS` keep their **names, defaults (250ms / 5000ms),
  and precedence** — but now bound CPU-time instead of wall-clock. In practice
  this only *loosens* legitimate slow/nested work; a runaway synchronous script
  is still cut at the same budget.
- **Error messages.** `exceeded timeout of Nms` → either `exceeded CPU budget of
  Nms` (script burned its CPU budget) or `exceeded wall-clock ceiling of Nms
  while awaiting host calls` (stuck on a never-settling host call). Update any
  code/tests matching the old string.

New knobs (additive):

- `QuickJSScriptRunner` option `wallCeilingMs` and env `OS_SANDBOX_WALL_CEILING_MS`
  — tune the wall ceiling (explicit option › env › 30s).
- `resolveSandboxTimeoutMs` (`@objectstack/types`) gains a `'wallCeiling'` kind.

Also fixes a latent init bug in the new accounting where the interrupt handler
could fire during `installCtx` and corrupt ctx marshalling. The nested-write
integration suites now run at the stock 250ms budget (previously forced to 10s),
which is itself the regression guard for the nested-charging fix.
