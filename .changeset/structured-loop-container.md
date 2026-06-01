---
"@objectstack/spec": minor
"@objectstack/service-automation": minor
---

feat(automation): structured control-flow constructs (ADR-0031) — loop container

Adopt structured control-flow as the native, AI-authored flow model (ADR-0031),
choosing representation **(B) nested sub-structure**: containers carry their body
as a self-contained single-entry/single-exit region in `config`.

- **spec**: new `automation/control-flow.zod.ts` defining the `loop` container
  (`config.body`), `parallel` block (`config.branches[]`, implicit join), and
  `try/catch/retry` (`config.try`/`config.catch`/`config.retry`) configs, plus
  region well-formedness analysis (`analyzeRegion`, `findRegionEntry`) and
  `validateControlFlow` (single-entry/single-exit, acyclic; bounded loop).
- **engine**: `registerFlow()` now rejects malformed control-flow regions before
  a flow can run; new `AutomationEngine.runRegion()` executes a body region in
  the enclosing variable scope without touching the shared DAG traversal.
- **loop executor**: replaces the no-op `loop` stub with a real iteration
  container — binds the iterator/index variables and runs the body once per item
  under a hard max-iteration guard. Legacy flat-graph loops (no `config.body`)
  keep working — the construct is additive.

Parallel-block and try/catch *engine execution* and BPMN interop mapping remain
follow-ups (issue #1479, tasks 3–5).
