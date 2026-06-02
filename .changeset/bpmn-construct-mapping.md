---
"@objectstack/spec": minor
---

feat(automation): BPMN ⇄ structured-construct model mapping (ADR-0031, task 5)

Add the semantic bridge between the structured control-flow constructs (the
native model) and the BPMN gateway/boundary/multi-instance vocabulary (kept for
interop only), at the **flow-model level** — independent of any wire format
(`automation/bpmn-mapping.ts`):

- `exportConstructsToBpmn(flow)` expands each construct into its BPMN
  interchange shape — `parallel` → `parallel_gateway` (AND-split) + branch
  regions + `join_gateway` (AND-join); `try_catch` → the protected activity +
  an error `boundary_event` + the handler region; `loop` → its body marked with
  multi-instance loop characteristics — so external BPM tools see a well-formed
  BPMN graph. Each expansion's anchor carries an `osConstruct` extension marker.
- `importBpmnToConstructs(flow)` folds that BPMN shape back into the constructs:
  exact reconstruction from the `osConstruct` marker (so `construct → BPMN →
  construct` is identity), and a best-effort structural fold of foreign
  `parallel_gateway`/`join_gateway` pairs, with diagnostics for shapes it can't
  safely fold.

BPMN 2.0 **XML** (de)serialization layers on top of this mapping and remains a
plugin concern (per `bpmn-interop.zod.ts`), out of scope here.
