# ADR-0020: State Machine — converge three declaration forms to one enforced `state_machine`

**Status**: Accepted — Implemented (2026-05-31)
**Deciders**: ObjectStack Protocol Architects
**Builds on**: [ADR-0019](./0019-approval-as-flow-node.md) (collapse approval into Flow — "one engine, fold the parasitic concept into its host"; this ADR applies the same principle to the state-machine concept), [ADR-0009](./0009-execution-pinned-metadata.md) (execution-pinned metadata), [ADR-0010](./0010-nl-to-flow-authoring.md) + [ADR-0011](./0011-actions-as-ai-tools.md) (AI authoring is the design center)
**Revises**: the #1398 outcome that "reclaimed `workflow` for state machines" — that reclaim left a *name* (`workflow`) and *three* declaration shapes, but no runtime enforcement. This ADR finishes the job.
**Consumers**: `@objectstack/spec` (`automation/state-machine.zod.ts`, `data/validation.zod.ts`, `data/object.zod.ts`, `kernel/metadata-*`), `@objectstack/objectql` (`validation/record-validator.ts`), `examples/app-crm` (`src/workflows/*.workflow.ts`)

---

## TL;DR

The platform has a "state machine" concept whose stated purpose is to **lock a record's legal status transitions** so that automation — increasingly **AI-generated** — cannot drive a record into an illegal state. Today that purpose is **not met**: the concept exists as **three overlapping declaration shapes** and **zero runtime enforcement**.

1. A top-level `workflow` metadata type backed by an XState-style `StateMachineSchema`.
2. A `stateMachines` map embedded on the object (`object.stateMachines`).
3. A `state_machine` **validation rule** (`{ fromState: [allowedToStates] }`).

No code executes any of them: `IWorkflowService` has no implementation, no XState interpreter exists, the record validator only checks field data types (it does not dispatch on validation-rule `type`), and nothing reads `object.stateMachines`. A declarative guardrail with no enforcement is decoration — and three ways to declare it is a hallucination trap for an AI author, which will pick one of the three and get silent no-op behaviour.

This ADR makes three decisions: **(D1) converge to one declaration shape — the `state_machine` validation rule, retiring both other shapes**, **(D2) name it `state_machine` and retire the top-level `workflow` metadata type**, and **(D3) enforce it on the write path** so illegal transitions are rejected. The shape stays conventional (textbook FSM) so an AI author's strong priors help rather than mislead.

The surviving shape is **already adopted** in `examples/app-showcase` (the `state_machine` rule on `Task`, `Project`, and `Account`) and passes typecheck — so this ADR mostly *removes* the other two shapes and *wires enforcement* for the one that's already in use, rather than inventing anything new.

## Context

### Why a state machine at all — the guardrail goal

The design intent is a **runtime guardrail**: declare which `status` transitions are legal, and have the engine reject any write that violates them. This is exactly the class of error an AI author makes — e.g. generating a Flow that sets `status` from `draft` straight to `closed`, skipping required intermediate states. A declared-and-enforced transition table catches that at write time.

### Today: three declaration shapes, zero enforcement

**Three shapes, one concept:**

| # | Where | Schema | Reference |
|---|-------|--------|-----------|
| 1 | Top-level `workflow` metadata type | `StateMachineSchema` (XState-style: hierarchical/parallel states, entry/exit actions, guards, context) | [`metadata-type-schemas.ts:85`](../../packages/spec/src/kernel/metadata-type-schemas.ts#L85), [`metadata-plugin.zod.ts:90`](../../packages/spec/src/kernel/metadata-plugin.zod.ts#L90), [`metadata-plugin.zod.ts:612`](../../packages/spec/src/kernel/metadata-plugin.zod.ts#L612) |
| 2 | Object-embedded | `object.stateMachines: Record<string, StateMachineSchema>` ("parallel lifecycles: status, payment, approval") | [`object.zod.ts:534`](../../packages/spec/src/data/object.zod.ts#L534) |
| 3 | Validation rule | `state_machine` rule: `transitions: { fromState: [toStates] }` | [`validation.zod.ts:105`](../../packages/spec/src/data/validation.zod.ts#L105) |

**Zero enforcement — verified across `packages/{runtime,objectql,services,core,metadata*,plugins}` and the whole repo:**

- `IWorkflowService` ([`workflow-service.ts:58`](../../packages/spec/src/contracts/workflow-service.ts#L58)) has **no concrete implementation**.
- There is **no XState interpreter** anywhere (no `createMachine` / `interpret` / transition engine).
- The write-path validator [`validateRecord`](../../packages/objectql/src/validation/record-validator.ts#L198) reads only `objectSchema.fields` and validates **field data types** (string/number/date/…). It **never reads `objectSchema.validations`** at all — so *not one* of the nine validation-rule types (`state_machine`, `cross_field`, `script`, `unique`, `format`, `json_schema`, `async`, `custom`, `conditional`) is enforced by it.
- **Nothing reads `object.stateMachines`.**

So the guardrail goal is currently unmet at runtime. The only artefacts that exist are declarations — e.g. [`examples/app-crm/src/workflows/stale-opportunity.workflow.ts:19`](../../examples/app-crm/src/workflows/stale-opportunity.workflow.ts#L19) (`StateMachineConfig`), which additionally **mixes orchestration into the machine** (it carries `email_alert` / `task_creation` actions that no engine executes — that orchestration belongs to a record-triggered Flow per ADR-0019).

#### The prior-state plumbing gap (the real implementation constraint)

A transition check needs **both** the prior and the new state. But the write path can't supply the prior state today: on update, [`engine.ts:1850`](../../packages/objectql/src/engine.ts#L1850) calls `validateRecord(schema, hookContext.input.data, 'update')` — passing only the **PATCH payload**, not the prior record. On `PATCH { status: 'done' }` there is no way to know the *from*-state without a read. So enforcing `state_machine` is not just "add a dispatch branch"; it requires **plumbing the prior (or merged) record into the rule-evaluation step**. This is a shared need: `cross_field` and `script` rules are equally crippled by receiving only the patch — so the fix should land **once for the whole `validations` union**, not as a `state_machine`-only patch (see D3).

### The design-center shift: AI is the author — optimise naming for the model's priors

Future automation is **AI-generated, human-previewed** (ADR-0010 / ADR-0011). That changes how we should name this concept:

- The audience for the *name* is the **model**, not a non-technical admin. The right heuristic is **"meet the model where its priors are"**: use the term that is densest in training data for this concept.
- "**state machine**" is that term — Rails `state_machine`, AWS Step Functions "State Machine", XState, Spring Statemachine. An AI given a field named `state_machine` with a `{ from: [to] }` transition table hits its priors and produces correct code. A coined term (e.g. `lifecycle`) forces the model off its priors onto local docs alone.
- `state_machine` also reads as **maximally distinct from `flow`** — eliminating the `flow` / `workflow` near-synonym ambiguity that makes an AI pick the wrong type.
- `lifecycle` is additionally **already overloaded** in this codebase (managed-by buckets and toolbar "lifecycle actions" in [`object.zod.ts`](../../packages/spec/src/data/object.zod.ts) at L354/L371/L410/L765), so reusing it would create a *new* ambiguity.

Corollary (a trap to avoid): if we name it `state_machine`, the **shape must also match the well-known shape**. A conventional name on a bespoke structure is the worst case — the model's priors fire on the name and mislead on the structure. Keep the shape textbook FSM.

### Industry precedent — and why this is *not* a Salesforce validation rule

Binding "legal transitions" to the data model is a well-trodden pattern, in two camps:

- **First-class FSM on the model** (a structured transition table): Rails **AASM** / `state_machine` gem (`transitions from: :a, to: :b` on the model), **Django** `django-fsm` (`@transition(source, target)`), **MS Dataverse/Dynamics** ("status reason transitions" configured on the table), **Jira** (issue-type workflow: statuses + transitions + validators), **ServiceNow** (State Model). Terms: *state machine / FSM / transition (source→target) / state model*.
- **Generic predicate emulating a transition**: **Salesforce** Validation Rules — a boolean formula using `ISCHANGED(Status)` + `PRIORVALUE(Status)` + `ISPICKVAL(...)`; TRUE blocks the save.

Our design is a deliberate **hybrid**: it lives in the *validation* bucket (write-time, object-bound — like Salesforce) but its payload is a *structured transition table* (like AASM/Django/Dataverse). That confirms the naming decision: `state_machine` matches the first camp's vocabulary (priors), while nesting it under `validations` matches the second camp's enforcement model — an AI author hits *both* priors at once.

How this differs from a Salesforce validation rule — same placement and trigger (object-bound, on save), different **representation**:

| | Salesforce Validation Rule | This `state_machine` rule |
|---|---|---|
| Form | generic boolean **formula**, TRUE = block | structured **transition table** `{ from: [to] }` |
| Expressing a transition | hand-coded `ISCHANGED` + `PRIORVALUE` + `ISPICKVAL` | list the edges |
| One rule covers | one forbidden condition (graph scattered across many rules) | the whole legal graph (one place) |
| Introspectable? | ❌ opaque formula text | ✅ machine-readable — UI greys out illegal buttons, an Agent can ask "from here, what's legal next?" |

The introspectability is the upgrade that serves the two design centers: **UI** reads `transitions[current]` to render only legal actions, and an **AI/Agent** reads the legal-next set instead of parsing a formula — which is the original "prevent AI mistakes" goal.

### Where it lives: one of nine validation-rule types

`state_machine` is one variant of the `ValidationRuleSchema` discriminated union ([`validation.zod.ts:362`](../../packages/spec/src/data/validation.zod.ts#L362)), alongside `script`, `unique`, `format`, `cross_field`, `json_schema`, `async`, `custom`, and `conditional`. It shares `BaseValidationSchema` (name/label/message/severity) and the same write-time enforcement semantics as its siblings. This is *why it stays in `validations`* (D1) rather than becoming a standalone metadata type or file: it is, precisely, a write-time validation whose payload happens to be a transition graph.

## Decision

### D1 — One declaration shape

Collapse the three shapes to **one: the `state_machine` validation rule** (#3) — a `field` plus a `{ fromState: [allowedToStates] }` map, inline in the object's `validations`. It is minimal, textbook, already the enforcement-path concept, and **already in use** in app-showcase. Both other shapes are retired:

- **Retire the top-level `workflow` metadata type** (#1). The XState-style `StateMachineSchema` (hierarchical/parallel states, context, entry/exit actions) is **orchestration machinery** — and orchestration was assigned to Flow by ADR-0019. As a *guardrail* it is over-built and, today, dead code.
- **Retire `object.stateMachines` (#2) as well.** It is the same XState `StateMachineSchema` in a second location, read by nothing. Keeping it "as an alternative host" would re-create the multi-shape hazard this ADR removes — the parallel-lifecycle need it cites (status + payment + approval) is met by **multiple `state_machine` rules, one per field**, in the same `validations` array. One authoring surface, not two.

Multiple independent lifecycles on one object are therefore N flat `state_machine` rules (one per field), *not* XState parallel regions — the showcase `Account`/`Project`/`Task` rules demonstrate the shape and varied topologies (forward-only with reopen, terminal states, re-entrant).

### D2 — Name it `state_machine`; retire `workflow`

The surviving guardrail is named **`state_machine`** (rule type, already so named). The top-level metadata type `workflow` is removed from the type registry and schema map. This is greenfield (no production data; per ADR-0019 §Greenfield) — a code refactor, not a data migration.

### D3 — Enforce it on the write path

Wire the `validations` union into the write path — today nothing evaluates it (see §prior-state plumbing gap). Concretely:

1. **Plumb the prior/merged record in.** Extend the rule-evaluation entry point (today [`validateRecord(schema, data, mode)`](../../packages/objectql/src/validation/record-validator.ts#L198)) to receive the prior record on update — e.g. `validateRecord(schema, data, mode, previous?)`, or run the rule pass from a `beforeUpdate` step that already holds both old and new. This unblocks `state_machine` **and** the currently-crippled `cross_field` / `script` rules in one move; do it union-wide, not `state_machine`-only.
2. **Transition check.** On update: if `old[field] !== new[field]` and `new[field] ∉ transitions[old[field]]`, **reject** with the rule's `message`. On insert: validate `new[field]` is the declared initial state — derived from the `Field.select` option marked `default: true` (no separate `initial` key needed; showcase relies on this).
3. **Introspection endpoint (follow-on).** Expose `legalNext(object, field, currentState)` so UI/Agents read the legal set instead of re-deriving it.

This is the highest-leverage change in the ADR: it turns the guardrail (and the rest of `validations`) from declaration into enforcement.

### D4 — Keep the shape conventional

The transition declaration stays a flat, recognizable FSM (`field` + `{ from: [to] }`, optional CEL `guard` per transition). No hierarchical/parallel/context machinery in the guardrail. Anything that needs "do something when the state changes" is a **record-triggered Flow** (ADR-0019), not part of the machine.

## Consequences

**Positive**
- The guardrail actually works: illegal transitions are rejected at write time — the AI-mistake protection the concept was created for.
- One shape, conventional name → an AI author has exactly one obvious, prior-aligned way to declare it; no silent no-op forms.
- `flow` / `workflow` ambiguity disappears.
- Dead code removed (`StateMachineSchema` XState surface, `object.stateMachines`, the unimplemented `IWorkflowService`).
- **Bonus:** plumbing the prior/merged record into rule evaluation (D3) also makes `cross_field` and `script` rules work on PATCH updates — they are silently broken today for the same reason.

**Negative / costs**
- Breaking schema change: `workflow` metadata type and `StateMachineConfig` authoring go away; `examples/app-crm/src/workflows/*.workflow.ts` must be rewritten (transition guard → `state_machine` rule; the `email_alert` / `task_creation` actions → a record-triggered Flow).
- Loses the *theoretical* expressiveness of hierarchical/parallel statecharts. Accepted: that was never enforced, and orchestration is Flow's job.

## Blast radius / implementation checklist

- [x] `spec`: remove `workflow` from the metadata type enum + registry ([`metadata-plugin.zod.ts`](../../packages/spec/src/kernel/metadata-plugin.zod.ts)) and the schema map ([`metadata-type-schemas.ts`](../../packages/spec/src/kernel/metadata-type-schemas.ts)).
- [x] `spec`: **canonical home — the `state_machine` validation rule** ([`validation.zod.ts`](../../packages/spec/src/data/validation.zod.ts)). Removed `object.stateMachines` ([`object.zod.ts`](../../packages/spec/src/data/object.zod.ts)) and the `stack.workflows` array ([`stack.zod.ts`](../../packages/spec/src/stack.zod.ts)). *(Deviation: kept the `StateMachineSchema` file — see Implementation notes.)*
- [~] `spec`: `IWorkflowService` — **kept as a documented follow-up**, not removed (see Implementation notes).
- [x] `objectql`: wire the `validations` union into the write path — new [`rule-validator.ts`](../../packages/objectql/src/validation/rule-validator.ts) (`evaluateValidationRules` / `needsPriorRecord` / `legalNextStates`), with the prior record plumbed into [`engine.ts`](../../packages/objectql/src/engine.ts) on single-row update. Enforces `state_machine`, `cross_field`, and `script` together.
- [x] `metadata-collection.zod.ts`: dropped the `workflows` collection key + `workflows: 'workflow'` plural mapping ([`metadata-collection.zod.ts`](../../packages/spec/src/shared/metadata-collection.zod.ts)).
- [x] `examples/app-crm`: rewrote `src/workflows/*.workflow.ts` — transition tables already live as the `opp_stage_transitions` `state_machine` rule on the opportunity object; side-effect actions became record-triggered / scheduled Flows ([`high-value-deal.flow.ts`](../../examples/app-crm/src/flows/high-value-deal.flow.ts), [`stale-opportunity.flow.ts`](../../examples/app-crm/src/flows/stale-opportunity.flow.ts)); removed the `workflows` registration from `objectstack.config.ts`.
- [x] `examples/app-showcase`: carries the surviving shape — `state_machine` rules on `Task`, `Project`, `Account`. Predicate conditions corrected to the `record.<field>` CEL scope form so enforcement actually fires.
- [x] Tests: [`rule-validator.test.ts`](../../packages/objectql/src/validation/rule-validator.test.ts) (16 cases — allow/reject/no-op transitions, execution-control, predicate fail-open, introspection). Updated `object.test.ts`, `metadata-plugin.test.ts`, `metadata-collection.test.ts`, `overlay-precedence.test.ts` for the retired shapes.

## Implementation notes (deviations from the proposal)

The proposal's intent is fully delivered — converge to the `state_machine` rule, retire the `workflow` metadata type, enforce on the write path — with three **bounded** deviations, all to avoid scope creep into unrelated subsystems:

1. **`StateMachineSchema` (the XState-style schema) is kept, not deleted.** It is still imported by the agent conversation lifecycle ([`ai/agent.zod.ts`](../../packages/spec/src/ai/agent.zod.ts)) and the discovery protocol ([`api/protocol.zod.ts`](../../packages/spec/src/api/protocol.zod.ts)). Only its role as the **`workflow` metadata-type backing schema** and the **`object.stateMachines` / `stack.workflows`** homes were removed. Deleting the schema outright would have churned the agent/protocol surfaces, which is a separate concern.

2. **The `workflow` *RPC service* surface is kept as a follow-up.** `CoreServiceName.workflow`, the `/api/v1/workflow` route catalog (`DEFAULT_WORKFLOW_ROUTES`), and `IWorkflowService` remain — they describe an *unimplemented optional service*, not the retired *metadata type*, and removing them touches the service-discovery contract and its tests. Tracked as a follow-up; the metadata-type retirement (the AI-hallucination hazard this ADR targets) is complete.

3. **No per-transition CEL `guard` was added** to `StateMachineValidationSchema` (it was "optional" in D3/D4). The flat `field` + `transitions` table is enforced as-is; a conditional transition can be expressed today as a sibling `script`/`conditional` rule. Guards can be added later without a breaking change.

**Enforcement scope:** rules run on single-row insert/update through the merged `{...previous, ...patch}` record. Multi-row (`updateMany`) updates **log a warning and skip** rule evaluation rather than silently enforcing on incomplete data — surfaced, not hidden.

## Alternatives considered

- **Name it `lifecycle`.** Rejected: off the model's priors vs. `state_machine`, and already overloaded in `object.zod.ts`.
- **Keep the full XState `StateMachineSchema` and build an interpreter.** Rejected: orchestration is Flow's job (ADR-0019); a statechart engine beside Flow re-creates the two-engine problem ADR-0019 just removed. The guardrail need is a flat transition table.
- **Keep `object.stateMachines` as an object-embedded host.** Rejected: it is the same XState schema in a second unread location; the parallel-lifecycle need it cites is met by N per-field `state_machine` rules. Two homes is the multi-shape hazard, not a convenience.
- **Make `state_machine` a standalone metadata type / `.state.ts` file.** Rejected: it is intrinsically a per-field constraint on one object (not reusable, not independently versioned), shares `BaseValidationSchema` with eight sibling rule types, and a standalone file just re-creates the top-level type this ADR retires. If a state table grows large, split the *TypeScript* (`export const fooValidations = [...]`), not the metadata model.
- **Encode transitions as a Salesforce-style `script` formula instead of a structured `state_machine` rule.** Rejected: a free-form predicate is not introspectable — UI can't grey out illegal actions and an Agent can't read the legal-next set, which is the whole point. The structured table is the upgrade over the Salesforce approach.
- **Leave all three shapes, just add enforcement to one.** Rejected: three declaration shapes for one concept is itself the AI-hallucination hazard this ADR exists to remove.
