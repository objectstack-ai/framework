# ADR-0039: Concurrent durable pause — multi-instance nodes now, token/scope-tree later

**Status**: Accepted — Track A implemented; Track B deferred (proposed 2026-06-11, revised after a code + industry self-review · calibrated 2026-06-12)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0019](./0019-approval-as-flow-node.md) (durable-pause node via suspend/resume — *between*-flow chaining added in its 2026-06-10 addendum), [ADR-0031](./0031-advanced-flow-node-executors-and-dag.md) (structured `loop` / `parallel` / `try_catch` constructs, DAG invariant), [ADR-0018](./0018-unified-node-action-registry.md) (open node/executor registry)
**Consumers**: `@objectstack/services/service-automation` (engine core — `executeNode` / `traverseNext` / `runRegion` / `resume`, `SuspendedRun`, `sys_automation_run`), `@objectstack/spec` (`automation/execution.zod.ts`), `../objectui` (Runs panel, flow runner)

---

## TL;DR

The engine tracks a paused run with a **single program counter** — `SuspendedRun.nodeId`,
one position — and suspend is implemented as a **thrown exception that unwinds
the call stack** (`FlowSuspendSignal`). That cannot represent **two pauses at
once**, so the engine **forbids pausing inside a `parallel` branch or `loop`
iteration** (`runRegion` converts a suspend inside a region into a hard error).
This blocks **parallel approvals** ("finance AND legal sign off concurrently")
and **batch approvals** ("route each line item over $10k").

The tempting answer — adopt a BPMN-style **token / scope tree** (Camunda) — is
the right *long-term* runtime model but is a **full engine-core rewrite**: it is
not just a data structure, it forces replacing three coupled things the current
engine relies on (see [Why the token tree is expensive](#why-the-token-tree-is-expensive-the-real-cost)).
A code review (below) shows the cost is much larger than the data-structure
change implies.

**Decision: two tracks.** Ship **Track A — multi-instance / aggregating nodes**
first: model the demand as *single nodes* that wait for N decisions, the way
Camunda multi-instance and AWS Step Functions `Map` do. Track A splits into a
**free** tier and a **bounded** tier — a distinction worth stating up front:
**A1 (parallel approval — one `approval` node aggregating N decisions) needs no
engine change and is shipped (#1708)**; **A2 (a `map` / multi-instance node for
batch approval) is NOT free** — because each item can pause, it needs a bounded
extension of the engine's resume path (N:1 aggregation or node re-entry), so it
is a separately-justified increment, not a free rider on A1. Defer **Track B —
the general token/scope tree** until demand exceeds what multi-instance covers;
this ADR records its design so Track A is built toward it, not away from it.

## Context — current state (verified 2026-06-11, against the code)

- **One position per run.** `SuspendedRun.nodeId` is a single node id. `resume`
  restores that one position and calls `traverseNext` from it.
- **Suspend is a thrown exception.** A pausing node throws `FlowSuspendSignal`;
  `executeNode` unwinds, `execute()` / `resume()` catch it and snapshot the one
  position. The JS call stack *is* the continuation while running; on resume the
  engine re-derives traversal from the single `nodeId` (it does not restore a
  stack).
- **`runRegion` bans pause structurally.** `parallel` / `loop` / `try_catch` run
  their region(s) through `runRegion`, which catches a `FlowSuspendSignal` and
  rethrows it as `Error("durable pause inside a structured region … is not
  supported")`. That is where the ban lives.
- **Two concurrency sources, not one.** Besides the structured `parallel` node,
  `traverseNext` already runs a node's **multiple unconditional out-edges
  concurrently via `Promise.all`** — raw graph fan-out. A suspend in either path
  unwinds and the siblings are not cancelled; correctness holds only because
  pause-in-branch is banned.
- **Variables are one flat shared `Map`.** `Map<string, unknown>` is shared by
  the whole run *and* every region/branch/iteration — there is **no scoping**.
  Loop iterations overwrite the iterator var in place; node output is written as
  `variables.set('${nodeId}.${key}', …)`. ADR-0031 deliberately runs regions "in
  the enclosing variable scope," i.e. on this same flat map.
- **Between-flow pause already works.** ADR-0019's addendum (subflow linked
  runs, #1693) chains *separate* runs across the subflow boundary — orthogonal
  to this ADR and unchanged by either track.

The gap is strictly **intra-flow concurrency + pause**: one run, several live
positions.

## Why the token tree is expensive (the real cost)

A self-review against Camunda/Zeebe/Flowable and the actual code found that the
token/scope tree is a *data structure* whose value only appears when paired with
**three execution-model changes the current engine does not have**. Adopting the
tree without these (as a first draft of this ADR did) is adopting the noun
without the verb.

1. **Recursion + throw  →  an explicit token scheduler.** Today execution is
   recursive `executeNode` and suspend is a thrown unwind. You cannot
   simultaneously "pause branch A" and "keep branch B running" with a thrown
   exception — `Promise.all` rejects on A's throw while B keeps mutating the
   shared map *after* the snapshot. Camunda/Zeebe instead run a **command/job
   queue**: pop a runnable token, advance it one step, persist; a token that
   hits a wait state simply stops being runnable (no exception). Concurrent pause
   *requires* this scheduler — it is the core rewrite, not a refactor.

2. **Flat shared map  →  hierarchical scope variables.** Camunda resolves a
   variable by walking **up the execution tree** (token scope → parent → … →
   process instance); a write defaults to the current scope and is discarded
   when the scope ends unless promoted. (The first draft of this ADR invented a
   "copy-on-write + merge-on-join" scheme — **no major engine does that**; it is
   both harder and semantically surprising.) Moving from one flat `Map` to
   scope-chained resolution touches **every** `variables.get`/`set`, every
   template interpolation, and every CEL evaluation in the engine.

3. **Per-run serialization.** Two sibling tokens (e.g. two parallel approvals
   decided at the same instant) would resume concurrently and race on shared run
   state and the join barrier. Camunda serializes commands **per process
   instance** (optimistic locking). v1 of Track B would likewise need to
   serialize token advances within a run — which means the concurrency is
   *logical* (independent pause points), not *parallel execution*. That is a
   real, honest limitation to state up front.

The token tree is correct long-term, but its cost is "rebuild the engine's
execution model," not "add a tree to `SuspendedRun`."

## Decision

### Track A (now) — multi-instance / aggregating nodes

Model the concrete demand as **single nodes** that internally fan out and
aggregate, leaving the engine's one-program-counter model intact:

Track A has **two tiers of cost** — a distinction the first revision of this ADR
got wrong by lumping them together. They are not equal.

**A1 — aggregating `approval` node (truly free; shipped #1708).** One `approval`
node with `behavior: 'unanimous'` over N approver groups opens **one**
`sys_approval_request` whose `pending_approvers` lists all groups (notified in
parallel) and stays suspended until every group approves, then resumes down
`approve` / `reject`. "Finance AND legal" is exactly this — **one node, one
program counter, paused once**. This needed **no engine change**: the
unanimous-over-N aggregation already exists in the approvals service and is
unit-tested; A1 added a showcase (`showcase_invoice_signoff`) and docs, browser-
verified. The aggregation state lives in the plugin's own `sys_approval_request`
row, not the engine.

**A2 — `map` / multi-instance node (NOT free — engine-adjacent).** A correction:
a `map` node that serves **batch approval** (each item can pause) **cannot** be
"no engine change," contrary to this ADR's first revision. Examined against the
code, every flavor needs a bounded extension of the engine's resume/bubble path:
  - *concurrent* map (N items pause at once) needs **durable N:1 aggregation +
    per-parent serialization + completion-ordering handling** — i.e. part of
    Track B's hard concurrency, just confined to one node;
  - *sequential* map (one item at a time) needs **resume-into-the-node** (process
    the next item) instead of the engine's resume-past-the-node default — the DAG
    has no back-edge to loop the node;
  - only a *synchronous, non-pausing* map is engine-free, and that does not serve
    batch approval (which pauses).
  The map node reuses ADR-0019's linked-runs (#1693) for the 1:1 bubble but
  extends it to N:1 / re-entry. It is a real, bounded engine task — smaller than
  the full Track B scheduler, but **not** the zero-cost item A1 was. It should be
  built only against concrete batch-approval demand, with the aggregation /
  re-entry semantics designed first.

So Track A as shipped (**A1**) covers *parallel* approvals at zero engine cost.
*Batch* approvals (**A2**) are a deliberate, separately-justified increment, not
a free rider on A1.

### Track B (deferred) — the general token / scope tree

When a flow genuinely needs to pause at **arbitrary, independent positions** that
multi-instance cannot express (e.g. two unrelated long-running waits on different
branches that each continue into different downstream logic), adopt the full
model:

- **Token** = `{ tokenId, scopeId, nodeId, status }`,
  `status ∈ { running | paused | completed | cancelled }`.
- **Scope** = a region instance (root flow, parallel branch, loop iteration, try
  region), nested by containment into a tree. A linear flow is a one-token /
  one-scope tree — the back-compat anchor (today's behavior unchanged).
- **Execution** is the scheduler of [§1 above](#why-the-token-tree-is-expensive-the-real-cost),
  not recursion. **Variables** are scope-hierarchical (§2). **Resume** targets a
  `tokenId` (defaulting to the sole paused token for back-compat) and is
  **serialized per run** (§3). **Split/join** are scope operations; a scope's
  join is a barrier that fires when its child tokens reach its single exit
  (ADR-0031 single-entry/single-exit makes this well-defined). **Failure**
  fails the scope and cancels siblings (interrupt) unless caught by a `try_catch`
  scope; this cancellation primitive is what later unlocks boundary events/timers.
- **Persistence is additive**: keep `nodeId` as the primary token's position so
  existing readers and one-pause flows are unchanged; add `tokens_json` for the
  full tree when there is more than one.
- **Authoring and DAG unchanged** (D7 below): tokens are runtime-only; the flow
  JSON, the designer, and the AI design center (ADR-0010/0011) are untouched, and
  no back-edges are introduced.

### D7 — invariants that hold on both tracks

- The flow JSON, the structured-construct authoring surface (ADR-0031), the AI
  design center, and the DAG invariant are **unchanged**. Concurrency is a
  runtime concern, never an authoring one.
- The single-position / single-token case stays bit-for-bit today's behavior.
- Subflow linked-runs (ADR-0019 addendum) composes with either track.

## Why not the other models

- **Serialize the interpreter stack** (Salesforce-Flow style): inlines child
  state into the parent, destroys per-branch run identity, and still cannot
  express N independent pauses. Rejected.
- **Event-sourced deterministic replay** (Temporal/Zeebe-internals style):
  requires every node to be deterministic/idempotent. ADR-0018's **open node
  registry** lets third-party executors run arbitrary side effects — the replay
  precondition does not hold here. This is a generative-ecosystem constraint, not
  a taste call. Rejected as the engine model.
- **Jump straight to the general token tree** (first draft of this ADR):
  correct long-term but over-built for the near-term demand, and its true cost
  (the three execution-model changes above) is not yet justified. Deferred to
  Track B.

## Consequences

- **Track A unblocks the real demand now** (parallel + batch approvals) with no
  engine-core rewrite, no persistence change, and no new concurrency hazards.
- **Track B is recorded, not started.** The team avoids a premature core rewrite
  while keeping a coherent target; Track A's multi-instance node is designed so
  its per-unit state could later be re-expressed as scoped tokens.
- **Honest limitation of Track A**: it does not allow pausing at a *free* point
  inside a hand-drawn parallel/loop region — only the structured aggregating node
  pauses. If a flow needs that, it is the signal to start Track B.
- **Observability**: Track A shows N per-unit rows under one node (e.g. the
  approvals list); Track B would show a tree of live positions. The Runs panel
  extends additively either way.

## Sequencing

1. **A1 — aggregating `approval` node. ✅ Shipped (#1708).** The
   `unanimous`-over-N-approver-groups aggregation already existed and was
   unit-tested; #1708 added the `showcase_invoice_signoff` worked example
   (finance AND legal, browser-verified) and docs. No engine change. Threshold /
   quorum (M-of-N) stays enterprise-tier per `approval.zod.ts`.
2. **A2 — `map` / multi-instance node (design-first; not started).** Collection
   in, per-item child unit, aggregation, single suspend at the node. **Cost
   correction**: because items can pause, this needs a bounded engine resume-path
   extension (durable N:1 aggregation for concurrent, or resume-into-node for
   sequential) — it is *not* the zero-engine-change item A1 was, so it is gated on
   concrete batch-approval demand and a design note that nails the aggregation /
   re-entry + serialization semantics first.
3. **B-gate** — only if a concrete flow needs arbitrary-position concurrent
   pause that a multi-instance node cannot express: open a follow-up ADR to start
   Track B at the scheduler, with the one-token refactor as the first,
   behavior-preserving step.

## Non-goals / deferred

- The general token/scope tree and its scheduler (Track B) — recorded, not
  scheduled.
- Distributed token execution across workers/nodes (one claimer per run stands).
- Concurrent loop iterations / true parallel I/O speedup (logical concurrency
  only; not a throughput feature).
- Full BPMN boundary-event / event-subprocess semantics (built on Track B's
  cancellation primitive; separate node-type ADR).
- Any change to the authoring model (D7).

## Relationship to prior ADRs

- **ADR-0019** gave durable pause for a single position and (addendum)
  between-flow chaining. Track A reuses that pause as-is (the aggregating node
  pauses once); Track B would generalize the within-flow position to a tree.
- **ADR-0031** defined the structured regions. Track A's multi-instance node is a
  new structured construct alongside them; Track B's scopes are their runtime
  dual. The DAG invariant and AI-authoring center are preserved on both.
- **ADR-0018**'s open registry is why replay models are rejected and why, when
  Track B comes, the Camunda-style scheduler (not Temporal replay) is the fit.
