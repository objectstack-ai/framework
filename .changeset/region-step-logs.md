---
'@objectstack/spec': patch
'@objectstack/service-automation': patch
---

feat(automation): surface structured-region body steps in run observability (#1505)

`loop` / `parallel` / `try_catch` previously ran their body, branch, and handler
regions against a region-local step log that was **discarded** — run logs
(`listRuns` / `getRun`) showed the container as a single opaque step, hiding the
per-iteration / per-branch steps that actually executed.

`AutomationEngine.runRegion()` now **returns** its body steps, and the container
node folds them into the parent run log via a new `NodeExecutionResult.childSteps`
field. Each surfaced step is tagged with its **immediate** container via three new
optional fields on `ExecutionStepLogSchema` (and the engine's `StepLogEntry`):

- `parentNodeId` — the enclosing `loop` / `parallel` / `try_catch` node
- `iteration` — zero-based loop iteration or parallel branch index
- `regionKind` — `loop-body` | `parallel-branch` | `try` | `catch`

Tagging fills only fields left undefined, so nested regions keep each step's
innermost container. A failed try-region attempt's partial steps are still not
surfaced (preserving `try_catch` retry semantics). Fully additive — existing run
logs and consumers are unaffected.
