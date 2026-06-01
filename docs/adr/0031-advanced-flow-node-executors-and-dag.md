# ADR-0031: Structured control-flow for flows (loop / parallel / try-catch) — native + AI-authored, BPMN as interop

**Status**: Proposed (2026-06-01)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0018](./0018-unified-node-action-registry.md) (open action registry — node types are an open vocabulary, executors are the source of truth), [ADR-0019](./0019-approval-as-flow-node.md) (durable-pause node via suspend/resume), [ADR-0010](./0010-nl-to-flow-authoring.md) + [ADR-0011](./0011-actions-as-ai-tools.md) (AI flow authoring — **the design center**)
**Consumers**: `@objectstack/services/service-automation` (engine + builtin executors), `@objectstack/spec` (`automation/flow.zod.ts`, `automation/bpmn-interop.zod.ts`, `studio/flow-builder.zod.ts`), `../objectui` (flow designer)

---

## TL;DR

The flow designer and protocol expose BPMN-style control nodes — `loop`,
`parallel_gateway`, `join_gateway`, `boundary_event` — but the engine has **no
executors** for them (`loop` is a no-op stub). The naive fix is "implement those
four BPMN token nodes." **This ADR argues against that** and instead adopts
**structured control-flow constructs** — a `loop` *container*, a `parallel`
*block*, and `try/catch/retry` — as the **native + AI-authored model**, keeping
the BPMN gateway/boundary node types in the protocol only as the **import/export
representation** that maps to/from the structured constructs.

The deciding lens is **AI authoring of flow metadata** ([ADR-0010/0011]). A
free-form node+edge graph with BPMN gateways/boundary/back-edges is **easy to
make semantically broken** (orphan joins, unbalanced gateways, deadlocks,
infinite cycles) — exactly the failure an LLM will produce confidently. A small
set of **structured constructs is well-formed by construction**, locally
composable, and statically analyzable — the right substrate for AI.

(Already shipped on this line: `wait` (#1469, durable timer/signal pause) and
`subflow` (synchronous reusable invoke). `subflow` stays a first-class *reuse*
primitive — it is **not** the loop mechanism.)

## Context — current state (verified 2026-06-01)

- **The engine is DAG-only.** `registerFlow()` → `detectCycles()` throws on any
  back-edge ("Only DAG flows are allowed"). A classic inline loop (body → loop
  back-edge) therefore cannot be registered.
- **`parallel` is partly free**: `traverseNext()` already runs a node's
  *unconditional* out-edges via `Promise.all`. The missing piece is a correct
  **join** (wait-for-all-then-continue-once).
- **Error handling already exists**: edges carry `type: 'fault'` (route on
  failure) and `errorHandling.strategy: 'retry'` (exponential backoff). This is
  already a structured-ish try/catch/retry — closer to what authors want than
  BPMN boundary events.
- **BPMN import/export is valued** (`automation/bpmn-interop.zod.ts`). The
  *protocol* must stay BPMN-complete so external BPM tools round-trip.
- **The repo is multi-agent.** Core `engine.ts` edits (traversal, cycle
  detection) must be deliberate and well-sequenced.

## The reframing — why structured beats graph+token for AI authoring

BPMN's gateway/boundary/token model is expressive but notoriously error-prone to
*author* (for humans, and more so for LLMs). For AI generating flow metadata,
**structured control-flow constructs** (like a programming language's AST:
sequence, branch, **loop**, **parallel**, **try/catch**) win on the three things
AI needs:

1. **Well-formed by construction.** A loop has a defined body + exit; a parallel
   block's join is implicit at block end; there are no raw back-edges or
   dangling tokens. An LLM can't easily emit a deadlock or an infinite loop.
2. **Locally composable.** AI generates a self-contained subtree; variables are
   in scope; no cross-node token wiring to get wrong.
3. **Statically analyzable / terminating.** The engine can validate
   well-formedness and bound iteration — and reject the malformed before run.

Concretely, the per-item-**subflow** loop (an earlier candidate) is *worse* for
AI: one loop forces **two** flows (parent + body) plus input/output mapping —
more artifacts, more plumbing to get wrong. A **self-contained inline loop** is
simpler for AI and humans alike.

## Decision

Adopt **structured control-flow constructs** as the native, AI-authored model:

### 1. Loop — a structured iteration *container* (not a back-edge, not a subflow)
A `loop` node owns a **bounded body region** (a single-entry/single-exit
subgraph) plus an "after-loop" continuation. The engine drives iteration over a
collection (`collection`, `iteratorVariable`) with a **hard max-iteration
guard**; the body region is scoped, not a raw cycle — so the **DAG invariant for
ordinary edges is preserved** and termination stays analyzable. (Inline, local,
AI-friendly.)

### 2. Parallel — a structured *block* with implicit join
A `parallel` construct declares N branch regions and continues **once when all
branches complete** — the join is implicit at block end, engine-synchronized
(per-run, race-free in single-threaded JS). No author-visible `join_gateway`
arrival-counting node to mis-wire or deadlock. (The existing `Promise.all`
fan-out is the execution substrate.)

### 3. Errors — structured `try/catch/retry`
Surface the engine's existing `fault` edge + `errorHandling.retry` as a
**structured try/catch/retry** attached to a step or block, rather than BPMN
boundary events. This is the low-code-native error model and is already
engine-backed.

### 4. DAG invariant — **kept**
Ordinary step-to-step edges stay acyclic. Iteration and parallel are **structured
containers**, not cycles or arbitrary token flow — so we get inline loops without
giving up termination/analyzability.

### 5. BPMN — protocol/interop only, maps onto the constructs
`parallel_gateway` / `join_gateway` / `boundary_event` and `boundaryConfig` stay
in the protocol + `bpmn-interop` + designer *rendering* (for import/display).
**BPMN import maps them onto the structured constructs** (parallel gateways → a
parallel block; loop markers / multi-instance → a loop container; boundary error
→ try/catch); export maps back. They are the interchange format, not the native
authoring model.

### 6. AI authoring — generate structured constructs from the live registry
Runnable-flow authoring (designer + AI) composes the structured constructs +
executable nodes from the live action registry (`/api/v1/automation/actions` +
each node's `configSchema`). Validity is schema-enforced (well-formed
containers), so AI output is runnable by construction. The full BPMN modeling set
remains available for interop, not for native authoring.

## Representation — open implementation question (flag, don't over-specify)

The flow model is today a flat `nodes[]` + `edges[]` graph. Two ways to carry
structured containers; **to be decided in the implementation ADR/PR**:

- **(A) Marker-delimited scoped regions** (recommended starting point): a `loop`
  / `parallel` node plus a matching scope-end marker; edges inside the scope are
  the body/branches; the engine validates single-entry/single-exit and executes
  the region as a unit. Keeps the flat graph the designer + BPMN use; adds
  structured *semantics* + validation on top.
- **(B) Nested sub-structure**: the container node carries a nested mini-flow
  (`config.body`). Cleaner AST, but diverges from the flat graph.

(A) is least disruptive and most BPMN-mappable; (B) is the cleaner long-term AST.
The choice, plus designer rendering of containers and migration of existing
flows, is the first task below.

## Consequences

- **Positive**: AI (and humans) author from a small set of constructs that are
  valid + terminating by construction; no proliferation of error-prone BPMN
  token nodes; inline loops without breaking the DAG invariant; BPMN
  import/export preserved as interop; error handling unified on try/catch/retry.
- **Cost**: bigger than "add four executors" — it introduces structured
  control-flow into the flow model (spec + engine + designer + a BPMN mapping).
  Delivered incrementally (below). Existing flat flows keep working (constructs
  are additive).

## Sequencing (roadmap)

1. **Spec-define the constructs** — `loop` container, `parallel` block,
   `try/catch/retry`: their schema, `configSchema`, and **well-formedness
   validation** (single-entry/single-exit regions; bounded loop). Pick
   representation (A) vs (B).
2. **Loop container** — engine execution (bounded iteration over a collection) +
   designer + e2e. *(Highest value; replaces the stub.)*
3. **Parallel block** — implicit-join execution (per-run synchronization) +
   designer + e2e.
4. **Try/catch/retry** — surface the existing `fault` + `retry` as a structured
   construct in spec + designer.
5. **BPMN mapping** — `bpmn-interop` import/export ↔ structured constructs.

## Non-goals / deferred

- Author-visible low-level BPMN `parallel_gateway` / `join_gateway` /
  `boundary_event` as the *native* model (kept for interop only).
- Relaxing the DAG invariant to allow arbitrary cycles (loops are structured
  containers instead).
- Runtime BPMN boundary events (timer/signal) — interop representation retained.

## Already shipped this line of work

- `wait` executor (#1469) — durable timer/signal pause.
- `subflow` executor — synchronous reusable invoke (depth-guarded; nested pause
  → clear error). Remains a reuse primitive, orthogonal to the loop container.
