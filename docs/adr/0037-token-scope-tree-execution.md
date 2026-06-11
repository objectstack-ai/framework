# ADR-0037: Token / scope-tree execution — durable pause inside parallel branches and loop iterations

**Status**: Proposed (2026-06-11)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0019](./0019-approval-as-flow-node.md) (durable-pause node via suspend/resume — *between*-flow chaining added in its 2026-06-10 addendum), [ADR-0031](./0031-advanced-flow-node-executors-and-dag.md) (structured `loop` / `parallel` / `try_catch` constructs, DAG invariant), [ADR-0018](./0018-unified-node-action-registry.md) (open node/executor registry)
**Consumers**: `@objectstack/services/service-automation` (engine core — `executeNode` / `traverseNext` / `resume`, `SuspendedRun`, `sys_automation_run`), `@objectstack/spec` (`automation/execution.zod.ts`), `../objectui` (Runs panel, flow runner)

---

## TL;DR

The engine tracks a paused run with a **single program counter** — `SuspendedRun.nodeId`,
one position. That is enough for a linear pause (`approval` / `screen` / `wait`
on the main path) but cannot represent **two pauses at once**. So the engine
**forbids pausing inside a `parallel` branch or a `loop` iteration** (ADR-0019 M1
scope note, `engine.ts`: "durable pause across parallel gateways is out of
scope"). That blocks the most-requested real shapes: *parallel approvals*
("finance AND legal sign off concurrently") and *batch approvals* ("route each
line item over $10k").

This ADR adopts a **token / scope-tree** runtime model — the established
BPMN-engine representation (Camunda / Flowable). A run's live state becomes a
**set of tokens** (execution positions) organized in a **scope tree** (the root
flow, each parallel branch, each loop iteration, each try region is a scope).
Any token can pause independently; a scope's join is a barrier that completes
when its child tokens arrive. The flow **authoring model is unchanged** — token
tree is a pure runtime representation, invisible to the flow JSON, so ADR-0031's
AI-authored structured constructs and the DAG invariant both stand.

This is a **core-engine rewrite** of traversal + suspend/resume + persistence —
deliberately phased, with the single-program-counter case becoming the
degenerate *one-token* tree so today's flows are bit-for-bit unchanged.

## Context — current state (verified 2026-06-11)

- **One position per run.** `SuspendedRun = { runId, flowName, nodeId,
  variables, steps, context, … }` — a single `nodeId`. Resume restores that one
  position and calls `traverseNext` from it.
- **Suspend unwinds the stack.** A pausing node throws `FlowSuspendSignal`,
  caught at `execute()` / `resume()`, which snapshots the one position. There is
  no place to record a *second* live position.
- **Structured constructs run their bodies synchronously.** `loop` / `parallel`
  / `try_catch` execute their region(s) to completion in-line (ADR-0031). A
  pausing node inside a region throws the suspend signal up through the
  container, discarding the other branches / iterations — hence the hard ban.
- **`parallel` is concurrent but not pausable.** `traverseNext` already runs
  unconditional out-edges via `Promise.all`, and the `parallel` block joins at
  block end — but a suspend inside one branch unwinds that branch and the
  siblings already in flight are **not** cancelled or persisted. Correctness
  holds only because pause-in-branch is forbidden.
- **Between-flow pause already works.** ADR-0019's addendum (subflow linked
  runs, #1693) chains *separate* runs across the subflow boundary. That is the
  *inter*-flow half and is orthogonal to this ADR — it keeps working unchanged.

The gap is strictly **intra-flow concurrency + pause**: one run, several live
positions.

## The reframing — why a token tree, and why not the alternatives

A flow run is a **token game** on a graph (BPMN's own mental model): a token
sits on a node; executing the node moves the token along its out-edges; a split
turns one token into several; a join consumes several and emits one. The
engine's "single `nodeId`" is the special case of *exactly one token that never
splits*. Generalizing to *a set of tokens* is the minimal change that makes
concurrent pause representable.

- **Why not "serialize the interpreter stack" (Salesforce-Flow style).**
  Snapshotting the call stack inlines child state into the parent and destroys
  per-branch run identity; it also does not naturally express *N* independent
  paused positions. Rejected.
- **Why not "event-sourced deterministic replay" (Temporal style).** Replay
  requires every node to be deterministic / idempotent. ADR-0018's **open node
  registry** lets third-party executors run arbitrary side effects — the replay
  precondition does not hold for this platform. Rejected. (This is a
  *generative-ecosystem* constraint, not a taste call: low-code + open plugins ⇒
  the Camunda branch, not the Temporal branch.)
- **Why the token/scope tree.** It is the runtime dual of ADR-0031's structured
  regions: a region instance *is* a scope, a scope's tokens *are* its live
  positions, and the join *is* the scope barrier. It is locally composable,
  statically bounded (no back-edges — ADR-0031's DAG invariant is preserved),
  and is the proven model in every BPMN engine. We are not inventing a runtime;
  we are adopting the standard one.

## Decision

### D1 — A run's live state is a set of **tokens** in a **scope tree**

- A **token** is one execution position: `{ tokenId, scopeId, nodeId, status }`
  where `status ∈ { running, paused, completed, cancelled }`.
- A **scope** is a region instance: the **root** flow, or an instance of a
  `parallel` branch / `loop` iteration / `try` or `catch` region. Scopes nest by
  containment → a tree. Each scope records `{ scopeId, parentScopeId, kind,
  iteration?, joinState }`.
- A linear flow with no concurrency is a **one-token, one-scope** tree —
  identical behavior to today (the back-compat anchor).

### D2 — Split / join are scope operations

- Entering a `parallel` block creates one **child scope per branch**, each
  seeded with a token at its region entry; the block's join barrier records how
  many branch tokens must arrive.
- Entering a `loop` creates one child scope per iteration (sequential by default;
  the model permits concurrent iterations behind a flag — out of scope for v1).
- A scope **completes** when all its tokens reach its single exit (ADR-0031
  single-entry/single-exit regions make this well-defined); completion emits one
  token into the parent scope at the container's ordinary out-edge — the
  existing "after-block / after-loop continuation."

### D3 — Any token may pause; the scope persists partial progress

- A pausing node (`approval` / `screen` / `wait`) sets **its token** to `paused`
  and snapshots the **whole tree** (all tokens, all scope join states, the
  variable scoping per D5). Sibling tokens keep running; the run is `paused`
  while **any** token is paused or running-then-pausable.
- The run is `completed` only when the root scope completes with no paused
  tokens; `failed` per D6.

### D4 — Resume targets a token

- `resume(runId, signal)` gains an optional `tokenId`. With exactly one paused
  token (today's universal case) it resolves unambiguously — **the existing
  single-argument resume is unchanged**. Approval/wait/screen already carry a
  correlation key; the engine maps `correlation → tokenId`.
- Resuming a token continues traversal **within its scope**; reaching the
  scope's exit decrements the parent join barrier. When the last branch token
  arrives, the join fires and the parent continues — possibly itself pausing
  again elsewhere.

### D5 — Variable scoping is copy-on-write per scope

- ADR-0031 keeps region bodies in the **enclosing variable scope**. With
  concurrent *paused* branches that share an enclosing map, a naive shared map
  lets one paused branch's later resume clobber another's reads. The model makes
  per-scope variable writes **copy-on-write**: a scope sees the enclosing values
  but its writes are isolated to its scope frame until it joins, at which point a
  defined **merge policy** folds them back (last-writer-wins by default;
  loop accumulation via explicit output variables, as today). The merge policy
  is a named decision point, not left implicit.

### D6 — Failure and cancellation are scope-scoped

- A token failing terminally **fails its scope**; by default the scope's failure
  **cancels its sibling tokens** in the same parent (interrupt semantics) and
  propagates up — matching the intuition "if the parallel block can't finish,
  the block fails." `try_catch` is the structured opt-out: a `try`-scope failure
  routes to the `catch` scope instead of propagating (ADR-0031, unchanged).
- Cancellation of a *running* token is cooperative (checked at node boundaries);
  cancellation of a *paused* token consumes its continuation and records it
  cancelled. This cancellation primitive is what later unlocks **boundary
  events / timers** (a separate follow-up ADR builds on it — see Non-goals).

### D7 — Authoring model and DAG invariant unchanged

- The flow JSON does **not** change. Tokens/scopes are runtime-only;
  `flow.zod.ts` and the designer are untouched. ADR-0031's structured constructs
  remain the authoring surface and the AI design center (ADR-0010/0011).
- No back-edges are introduced. Scopes are acyclic single-entry/single-exit
  regions; iteration stays the loop container's job. The DAG invariant holds.

## Representation — persistence evolution (additive)

`SuspendedRun` / `sys_automation_run` evolve **additively**:

- Keep `nodeId` as the **primary token's** position (the first/only paused token)
  so existing readers, the Runs panel, and one-pause flows keep working with no
  change.
- Add `tokens_json` (and the scope tree) as a new JSON column / field carrying
  the full set when there is more than one. A row with no `tokens_json` is a
  one-token run — rehydrated as today. This mirrors the ADR-0019 discipline of
  not breaking the suspended-run table; the single new additive column is the
  deliberate exception this feature requires.
- `resume` continuation, correlation→token mapping, and the cold-boot
  wait-timer re-arm (#1687) all extend to address a token instead of the run.

`execution.zod.ts` gains a `tokens[]` / `scopes[]` shape on the run log;
`ExecutionStepLogSchema` already tags steps with `parentNodeId` / `iteration` /
`regionKind` (ADR-0031 #1505), which the token model formalizes as scope ids.

## Consequences

- **Unlocks** parallel approvals, batch (per-iteration) approvals, concurrent
  waits, and lays the cancellation primitive for boundary timers/events.
- **Core risk.** Traversal, suspend/resume, and persistence are the engine's
  heart; this is the largest change to it since ADR-0019. Mitigated by phasing
  (below) with the one-token degenerate case as a behavior-preserving anchor and
  the full existing suite as the regression gate at every phase.
- **Observability improves**: the Runs panel can show a tree of live positions
  ("branch ① paused at approval, branch ② done") instead of one node.
- **No authoring or migration cost** for existing flows — they are one-token
  trees; the JSON, the designer, and stored runs are untouched.
- **Subflow linked-runs (ADR-0019 addendum) composes**: a subflow token whose
  child run pauses stays `paused` in its scope exactly like any other pausing
  node — inter-flow chaining and intra-flow tokens stack cleanly.

## Sequencing (roadmap)

Each phase ships behind tests; the suite stays green throughout.

1. **2a — Internal token model, zero behavior change.** Represent today's
   single program counter as a one-token / one-scope tree inside the engine.
   `executeNode` / `traverseNext` / `resume` operate on tokens; structured
   containers create child scopes but still run synchronously. No new capability;
   pure refactor that de-risks the rewrite. *Gate: full suite unchanged.*
2. **2b — Pause inside `parallel` branches.** The most-requested case (parallel
   approvals). Join barrier persists partial completion; branch tokens pause and
   resume independently; D5 copy-on-write + merge lands here.
3. **2c — Pause inside `loop` iterations.** Batch approvals. Sequential
   iterations first; the per-iteration scope is the unit of pause.
4. **2d — Cancellation / interrupt (D6).** Sibling cancellation on scope
   failure; cooperative running-token cancellation. Unblocks a follow-up ADR for
   **boundary events / timers** (BPMN interrupting boundaries map onto this).

## Non-goals / deferred

- **Distributed token execution** across workers/nodes. v1 keeps one claimer per
  run (today's model); tokens are concurrent *within* a process, not sharded
  across machines.
- **Parallel I/O speedup as a goal.** Concurrency here is about independent
  *pause*, not throughput; any wall-clock win is incidental.
- **Full BPMN boundary-event / event-subprocess semantics.** The cancellation
  primitive (2d) is the foundation; the node-type surface is a separate ADR.
- **Concurrent loop iterations** (fan-out map). The model permits it behind a
  flag; v1 ships sequential iteration only.
- **Changing the authoring model.** Out of scope by D7 — tokens are runtime-only.

## Relationship to prior ADRs

- **ADR-0019** gave durable pause for a *single* position and (in its addendum)
  *between*-flow chaining. This ADR generalizes the *within*-flow position from
  one to a tree. The resume contract and `sys_automation_run` extend additively.
- **ADR-0031** defined the structured regions; this ADR is their **runtime
  dual** — a region instance is a scope. The DAG invariant and AI-authoring
  center are explicitly preserved.
- **ADR-0018**'s open registry is the reason replay-based models are rejected
  (D-reframing) and why the token/scope model is the right fit.
