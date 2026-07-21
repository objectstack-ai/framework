# ADR-0044: Flow-level send-back-for-revision — `revise` branch + typed back-edge re-entry

**Status**: Accepted — engine + model implemented; designer pending (objectui) (proposed 2026-06-12 · calibrated 2026-06-12)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0019](./0019-approval-as-flow-node.md) (approval as a durable-pause flow node), [ADR-0039](./0039-token-scope-tree-execution.md) (single-program-counter suspend model), thread interactions (#1740), [ADR-0042](./0042-approval-sla-escalation.md) (audit-first discipline)
**Closes**: [#1744](https://github.com/objectstack-ai/objectstack/issues/1744)
**Consumers**: `@objectstack/spec` (flow edge type, branch labels, contracts), `@objectstack/service-automation` (back-edge traversal), `@objectstack/plugin-approvals` (send-back / resubmit runtime), REST, Console approvals inbox

---

## TL;DR

`requestInfo()` (#1740) is a conversation: the request stays pending, the
record stays locked, the approver keeps the slot. Mainstream approval
centers also model 退回修改 / *send back for revision* — a **flow
movement**: the current approval request terminates, the flow walks a
`revise` out-edge to a wait point where the record unlocks and the
submitter edits it, and a *resubmit* walks a **back-edge** into the
approval node, opening a fresh request (round 2) with a clean approver
slate. A `maxRevisions` guard auto-rejects instances that would orbit
forever.

```
approval (suspended, round N)
  ├─ approve ──▶ …
  ├─ reject ───▶ …
  └─ revise ──▶ wait (suspended; record unlocked; submitter edits)
                  └─ resubmit ──[back-edge]──▶ approval (round N+1)
```

## Decisions

### D1 — the sent-back request's terminal state is a new `ApprovalStatus: 'returned'`

A third terminal state alongside `approved` / `rejected` / `recalled`
(do **not** reuse `recalled`: recall is submitter-initiated withdrawal,
returned is approver-initiated rework — inbox filters, SLA reporting and
the status mirror must distinguish them). Because the record lock and the
`openNodeRequest` per-(object, record) pending-dedupe are both keyed on
`status: 'pending'`, finalizing round N as `returned` *automatically*
unlocks the record and clears the way for round N+1 — no lock-machinery
change at all.

Sync points (dual-source enums, all updated together):
`ApprovalStatus` (spec contracts), `sys_approval_request.object.ts`
status select, and the Console status filters/badges.

### D2 — `revise` joins `APPROVAL_BRANCH_LABELS`; `maxRevisions` joins the node config

- `APPROVAL_BRANCH_LABELS = { approve, reject, revise }`. The decision
  surface stays `approve | reject` (`ApprovalDecision` unchanged);
  send-back is a **separate service verb** (`sendBack`), mirroring how
  `recall` is not a "decision".
- `ApprovalNodeConfigSchema` gains
  `maxRevisions: int ≥ 0, default 3` — the maximum number of send-backs
  per (run, node). A send-back that would *exceed* the budget instead
  **auto-rejects**: the request finalizes `rejected` (audit carries the
  revise intent + an auto-reject marker comment), and the run resumes
  down the `reject` edge with `output.decision = 'reject'`,
  `output.autoRejected = true`. `maxRevisions: 0` ⇒ send-back always
  auto-rejects (effectively disabled, loudly).
- A flow whose approval node has **no `revise` out-edge** rejects
  `sendBack` with `VALIDATION_FAILED` (checked against
  `automation.getFlow()` before any mutation). This guards the engine's
  label-fallback behavior — resuming with an unmatched `branchLabel`
  falls back to *all* out-edges, which must never happen by a user
  clicking a button.

### D3 — wait-node + REST resubmit (not record-change triggers)

The revise edge targets an ordinary **`wait` node** (signal flavor) — the
durable pause already shipped for timers/signals. The revise window is
therefore *visible flow state* (designer canvas, run logs, suspended-run
stores all already understand it), not an invisible service limbo.

Resubmit is an explicit REST verb by the submitter:

```
POST /api/v1/approvals/requests/:id/revise    (approver; audited 'revise')
POST /api/v1/approvals/requests/:id/resubmit  (submitter; audited 'resubmit')
```

`resubmit` validates: actor is the submitter, the request is `returned`,
and it is the **latest** request for its (run, node) — then resumes the
run (branch label `resubmit`, informational). Traversal walks the
back-edge into the approval node, whose executor re-runs `openNodeRequest`
→ round N+1 pending request → re-lock → suspend. A record-change trigger
was rejected: saving a draft mid-edit must not resubmit; an explicit
"I'm done" verb matches every mainstream approval center and gives the
UI an unambiguous button.

New audit kinds `'revise'` / `'resubmit'` join `ApprovalActionKind` AND
the `sys_approval_action` select enum (dual-source, missed sync = insert
500). Both rows land on the *round-N* request: round N's trail ends
`… revise → resubmit`, round N+1 opens with its own `submit`.

### D4 — round numbering rides the config snapshot (`__round`), no migration

`openNodeRequest` counts existing requests for (`flow_run_id`,
`flow_node_id`) and stamps `__round: N+1` into `node_config_json`
(precedent: `__flowLabel` / `__nodeLabel`). Surfaced as `round?: number`
on `ApprovalRequestRow` (absent/1 ⇒ first round). `current_step_index`
keeps its existing meaning; no schema change, old rows read as round 1.

### D5 — engine: typed back-edges, re-entry semantics, runaway guard

The flow spec docs already promise back-edges (*"back-to-previous
rejection → a back-edge to an earlier node"*); the executor now honours
them, under explicit constraints:

- **Authoring**: `FlowEdgeSchema.type` gains `'back'`. A back-edge is an
  ordinary traversal edge at run time; its *only* special property is
  that **cycle validation ignores it**. `registerFlow` validation becomes:
  the graph **minus `back`-typed edges must be a DAG** (the existing
  `detectCycles` runs on the reduced graph). An unmarked cycle is still
  rejected — authors must opt in, edge by edge.
- **Re-entry semantics** (same node, second visit): node outputs are
  written under `${nodeId}.${key}` — a re-entry **overwrites** (latest
  round wins), which is exactly what `decision`-style outputs want;
  the step log appends (every visit is a separate step entry, so run
  observability shows round 1 and round 2); a re-suspend at the same
  node persists a fresh continuation under the same `runId` (the resume
  path already rebuilds `SuspendedRun` from live state — no keyed-by-node
  assumption exists).
- **ADR-0039 compatibility**: the single-program-counter invariant is
  untouched — a back-edge moves the *one* position backwards; it never
  creates a second concurrent position. Back-edges remain **banned inside
  structured regions** (regions stay acyclic per ADR-0031 validation, and
  durable pause inside a region is already rejected). ADR-0039's D7
  "no back-edges" applied to *Track B's runtime tokens*; this ADR amends
  the authoring surface deliberately and narrowly.
- **Runaway guard**: `executeNode` counts top-level visits per node
  (step-log entries without a `parentNodeId`, so loop-region iterations
  don't count); exceeding `MAX_NODE_REENTRIES = 100` fails the run with
  a loud error. This is the engine's backstop; the *product* guard is
  `maxRevisions` (D2), which terminates well before.

### D6 — lock lifecycle and the interaction matrix

| moment | request status | lock |
|---|---|---|
| round N pending | `pending` | locked |
| revise window (run at wait node) | `returned` | **unlocked** (hook keys on pending) |
| after resubmit (round N+1) | new row `pending` | re-locked |

- **unanimous × revise**: one approver's send-back finalizes the request
  immediately (like reject under unanimous). Round N+1 reopens with the
  **full approver set**; prior approvals do not carry over — the data
  changed, so every sign-off is stale by definition.
- **recall × revise window**: the submitter may abandon a revision —
  `recall` on the *latest `returned`* request (the one normal recall
  precondition `pending` doesn't cover) flips it `returned → recalled`
  (the one sanctioned terminal→terminal transition) and audits `recall`.
  The run is paused at the *wait node*, which has no `reject` out-edge to
  resume down — so this lands the engine's first **run-cancel primitive**:
  `cancelRun(runId, reason)` consumes the continuation and records a
  terminal `cancelled` log (`ExecutionStatus` already reserves the value).
  Recall of a *pending* request keeps its existing reject-edge resume.
  SLA escalation, reminders and action links all key on `pending` and are
  naturally inert during the window.
- **escalation × revise**: `returned` requests are invisible to the
  escalation sweep (it scans `pending`); round N+1 starts a fresh SLA
  clock from its own `created_at`. Deliberate: the clock measures *this
  approver's* latency, not the submitter's rework time.

## Why not the alternatives

- **Reuse `recalled` for sent-back** — collapses two different actors and
  intents into one state; the inbox can no longer say "waiting on you to
  fix and resubmit" vs "you withdrew this".
- **Approval node re-suspends itself in a "revise mode"** (no wait node,
  no back-edge) — hides a whole state machine inside one node, invisible
  to the canvas/run log, and still needs re-entry semantics the moment a
  second round opens a new request.
- **Record-change-triggered resubmit** — every draft save becomes a
  resubmission; no explicit user intent; collides with the lock hook's
  system-write exemptions.
- **Generic engine `goto`/jump API** — strictly more power than needed;
  typed back-edges keep the authored graph the single source of truth
  and keep validation decidable.

## Consequences

- **Revise window × record-change triggers**: an edit made inside the
  window can re-fire the very record-change trigger that opened the flow
  (the showcase budget flow gates on `budget != previous.budget`), opening
  a *parallel* run's pending request on the same record. `resubmit`
  refuses with `DUPLICATE_REQUEST` while any pending request collides on
  the record — refusing *before* the suspension is consumed, so the
  parked run stays resumable once the collision is recalled. Flow authors
  should gate such start conditions (e.g. on the mirrored approval-status
  field) when the trigger field is one the submitter is expected to edit
  during revision.

- The DAG invariant softens to "DAG modulo declared back-edges" — cycle
  detection, designer validation and AI flow authoring all need the same
  reduced-graph rule (Studio designer support for *drawing* revise edges
  is a follow-up issue; the model/engine land first).
- Two enum dual-sources gain values (`returned`; `revise`/`resubmit`) —
  the known 500-on-insert trap if either side is missed.
- `IApprovalService` grows `sendBack()` / `resubmit()`; REST grows the
  two verbs; Console inbox grows the approver button, the submitter
  resubmit entry, timeline rendering and ten-locale strings.
- Round-aware inbox: `round` on the row enables "Round 2" chips with no
  migration.

## Test matrix (the real cost, ADR-0039 style)

multi-round (1→2→3) × `unanimous` (send-back mid-round clears partial
approvals) × lock states (locked → unlocked → re-locked) × recall crossing
the revise window × `maxRevisions` overflow auto-reject × flows with no
revise edge (sendBack rejected) × engine: back-edge registration passes /
unmarked cycle still rejected / re-entry overwrites outputs / runaway
guard trips.
