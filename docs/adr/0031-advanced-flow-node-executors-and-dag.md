# ADR-0031: Advanced flow-node executors (loop / parallel / boundary) and the DAG invariant

**Status**: Proposed (2026-06-01) — awaiting decision on D1–D4
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0018](./0018-unified-node-action-registry.md) (open action registry — node types are an open vocabulary, executors are the source of truth), [ADR-0019](./0019-approval-as-flow-node.md) (durable-pause node via suspend/resume), [ADR-0010](./0010-nl-to-flow-authoring.md) + [ADR-0011](./0011-actions-as-ai-tools.md) (AI flow authoring — the design center)
**Consumers**: `@objectstack/services/service-automation` (engine + builtin executors), `@objectstack/spec` (`automation/flow.zod.ts`, `automation/bpmn-interop.zod.ts`, `studio/flow-builder.zod.ts`), `../objectui` (flow designer)

---

## TL;DR

The flow designer (and the spec's `FlowNodeAction` / BPMN-interop / flow-builder
palette) expose `loop`, `parallel_gateway`, `join_gateway`, `boundary_event`,
but the engine has **no executors** for them (and `loop` is a no-op stub). This
session shipped executors for the two tractable ones — **`wait`** (durable
timer/signal pause) and **`subflow`** (invoke another flow). The remaining four
need decisions because they collide with a deliberate engine invariant and with
a now-valued capability:

1. **The engine is DAG-only.** `AutomationEngine.detectCycles()` throws on *any*
   back-edge ("Only DAG flows are allowed"). A classic inline loop (body →
   loop back-edge, Salesforce/Power-Automate "Apply to each") therefore **cannot
   be registered** without relaxing this invariant.
2. **BPMN import/export is valued** ([ADR-0018] open registry +
   `automation/bpmn-interop.zod.ts`). So the *protocol* should stay
   BPMN-complete (keep `parallel_gateway` / `join_gateway` / `boundary_event` as
   modeling concepts) even where the *runtime* doesn't execute them yet.
3. **The repo is multi-agent.** Edits to the shared core `engine.ts`
   (traversal, cycle detection, error path) carry real collision risk and should
   be deliberate, not incidental.

This ADR records the options and a recommendation per decision; it does **not**
change code. Implementation follows once D1–D4 are decided.

## Context — current state (verified 2026-06-01)

| Node type | Designer | Spec (`FlowNodeAction`) | BPMN-interop | Engine executor |
|---|---|---|---|---|
| start, end, decision, assignment, screen, script, notify, http_request, connector_action, CRUD | ✅ | ✅ | — | ✅ |
| `wait` | ✅ | ✅ | — | ✅ **shipped (#1469)** — durable timer/signal pause |
| `subflow` | ✅ | ✅ | — | ✅ **shipped** — synchronous child-flow invoke |
| `approval` | ✅ | ✅ | — | ✅ (plugin-approvals — durable pause) |
| `loop` | ✅ | ✅ | — | ⚠️ **stub** — sets `$loopItems`/`$loopIndex`, does **not** iterate a body |
| `parallel_gateway` | ✅ | ✅ | `bpmn:parallelGateway` | ❌ none |
| `join_gateway` | ✅ | ✅ | `bpmn:parallelGateway` (join) | ❌ none |
| `boundary_event` | ✅ | ✅ + `boundaryConfig` | `bpmn:boundaryEvent` | ❌ none |

Relevant invariants / facts:

- **DAG-only**: `engine.ts` `registerFlow()` → `detectCycles()` (DFS, GRAY/BLACK)
  throws `Flow contains a cycle … Only DAG flows are allowed` on any back-edge.
- **Parallel is partly free**: `traverseNext()` already runs a node's
  *unconditional* out-edges concurrently via `Promise.all`. So an AND-**split**
  is essentially already supported; the missing piece is the AND-**join**
  (wait-for-all-then-proceed-once).
- **Error handling already exists**: edges carry `type: 'fault'`; on a node
  failure the engine routes to its fault edge, and `errorHandling.strategy:
  'retry'` does exponential-backoff retry. This is the low-code-native
  error model — a BPMN `boundary_event` would be a *second*, heavier mechanism.
- **Open vocabulary**: `FlowNode.type` is `z.string()` (ADR-0018) — the
  `FlowNodeAction` enum is the *curated built-in list*, not a hard constraint;
  plugins may register more types. Unknown types throw `NO_EXECUTOR` at run time.
- **AI authoring** ([ADR-0010/0011]) is a design center: generation should be
  driven by what's *executable*, not a static list that may overpromise.

## Decisions

### D1 — Keep the DAG invariant, or relax it for loop/cycle constructs?

- **D1a (recommended): keep strict DAG.** Model iteration *without* raw
  back-edges (see D2b/D2c). Pros: preserves a simple, analyzable execution model
  (termination, no infinite loops by construction, clean BPMN/AI reasoning); no
  surgery on shared `engine.ts` cycle detection. Cons: inline back-edge loops
  aren't expressible as raw cycles.
- **D1b: relax DAG for designated loop nodes.** Allow a back-edge into a `loop`
  node; make traversal loop-aware (iteration state + a hard max-iteration
  guard). Pros: true inline-body loops (familiar UX). Cons: a core-engine
  architecture change (cycle detection + traversal), recursion/termination
  risk, higher multi-agent collision risk.

### D2 — Loop semantics

- **D2a: inline back-edge loop** — requires D1b.
- **D2b (recommended now): per-item subflow loop** — `loop` runs a subflow body
  once per collection item (`config.collection`, `config.bodyFlow`,
  `config.iteratorVariable`), reusing the just-shipped `subflow` machinery.
  DAG-safe; **new executor file only, no `engine.ts` surgery**; bounded by a max
  iteration count. Body lives in a separate (template) flow — slightly less
  ergonomic than inline, but a legitimate, common model.
- **D2c (richer follow-up): bounded "for-each" container** — a `loop` whose body
  is an inline sub-region the engine expands per item (no raw cycle: the body is
  a bounded subgraph, not a back-edge). More ergonomic than D2b, still
  DAG-safe, but needs engine support to scope the body region.

### D3 — Parallel split / join

- **Split**: ship a trivial pass-through `parallel_gateway` executor now — the
  existing `Promise.all` on unconditional edges already forks branches. Low risk,
  contained.
- **Join (`join_gateway`)**: needs the engine to track per-run arrivals at the
  join node and proceed once all incoming branches arrive. JS is single-threaded
  so a per-run arrival counter is race-free, but it's a deliberate
  `traverseNext` enhancement (shared `engine.ts`). **Recommended**: split now;
  join as a separate, deliberate PR (or defer).

### D4 — Boundary events

- **Recommended: lean on the existing `fault` edge + `errorHandling.retry`**
  (already engine-backed) as the low-code error model; invest in *designer
  support for fault edges + retry* rather than a parallel BPMN mechanism.
- Keep `boundary_event` + `boundaryConfig` in the **protocol** for BPMN
  import/export, but **defer the runtime executor** (timer/signal boundaries
  especially need interruptible long-running hosts). Document it as
  modeling/interop-only until demanded.

### D5 — Authoring honesty + AI (cross-cutting, low controversy)

- Keep the **full modeling set** (incl. BPMN gateways/boundary) in spec +
  BPMN-interop + designer *rendering* (needed for import/display).
- Drive **runnable-flow authoring and AI generation from the live action
  registry** (`GET /api/v1/automation/actions` + `configSchema`), so authors/AI
  only compose *executable* nodes; the modeling superset stays available for
  BPMN round-trip. Ensure `NO_EXECUTOR` run-time errors are clear.

## Recommendation (one line)

**D1a + D2b + (D3 split now, join later) + D4 (fault-edge model; boundary
deferred to interop-only) + D5.** I.e. keep the DAG invariant; ship a
DAG-safe per-item-subflow `loop` and a pass-through `parallel_gateway` split as
contained new executors; treat `join_gateway`, an inline-loop (D1b/D2c), and a
runtime `boundary_event` as deliberate, ADR-gated engine work; keep the protocol
BPMN-complete and drive authoring/AI from the executable registry.

## Consequences

- **Positive**: no risky surgery on the shared core engine now; real, runnable
  `loop` + parallel-split shipped; BPMN import/export preserved; AI/authoring
  honest (executable registry); a clear roadmap for the deferred items.
- **Cost**: inline-body loops and true joins wait for a deliberate engine
  iteration; per-item-subflow loop requires authoring the body as a (template)
  subflow.

## Non-goals / deferred (roadmap)

- Relaxing the DAG invariant (D1b) and inline-body loops (D2c).
- `join_gateway` arrival synchronization.
- Runtime `boundary_event` (timer/signal/error) — protocol/interop retained.

## Already shipped this line of work

- `wait` executor (#1469) — durable timer/signal pause.
- `subflow` executor — synchronous child-flow invoke (depth-guarded; nested
  pause → clear error). Worked showcase examples for both.
