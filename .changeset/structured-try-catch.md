---
"@objectstack/service-automation": minor
---

feat(automation): structured try/catch/retry block (ADR-0031, task 4)

Implement engine execution for the `try_catch` construct — structured error
handling (ADR-0031 §Decision 3). The node runs a protected `try` region; on
failure it retries with exponential backoff (`config.retry`), and if it still
fails the optional `catch` region runs with the caught error bound to
`config.errorVariable` (default `$error`). Both regions execute in the enclosing
variable scope via `AutomationEngine.runRegion`.

- New `builtin/try-catch-node.ts` executor (registered as a built-in).
- `try` success (incl. a successful retry) → node succeeds; `catch` handling a
  failure → node succeeds; no `catch` / failing `catch` → node fails to the
  flow's fault edge / error handling.
- Well-formedness (single-entry/single-exit `try`/`catch` regions) is already
  enforced at `registerFlow()` by `validateControlFlow` (shipped with the loop
  container).

Showcase `ResilientSyncFlow` demonstrates the construct. This completes the
native control-flow execution trio (loop / parallel / try-catch); BPMN interop
mapping remains a follow-up (#1479 task 5).
