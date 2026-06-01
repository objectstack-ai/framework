---
"@objectstack/service-automation": minor
---

feat(automation): structured parallel block (ADR-0031, task 3)

Implement engine execution for the `parallel` block — a structured construct
with an **implicit join** (ADR-0031 §Decision 2). The `parallel` node declares N
branch regions in `config.branches[]`; the executor runs them concurrently in
the enclosing variable scope (via `AutomationEngine.runRegion`) and continues
once when all branches complete — no author-visible split/join gateway.

- New `builtin/parallel-node.ts` executor (registered as a built-in).
- Branch failure fails the block (surfaced as a node failure → fault edge/error
  handling); durable pause inside a branch is a clear error.
- Well-formedness (≥2 branches, single-entry/single-exit regions) is already
  enforced at `registerFlow()` by `validateControlFlow` (shipped with the loop
  container).

Showcase `FanOutNotifyFlow` demonstrates the parallel block. Try/catch execution
and BPMN interop mapping remain follow-ups (#1479 tasks 4–5).
