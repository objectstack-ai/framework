---
"@objectstack/spec": minor
"@objectstack/objectql": minor
"@objectstack/runtime": patch
"@objectstack/platform-objects": patch
"@objectstack/cli": patch
---

ADR-0020 — converge the three "state machine" declaration shapes to one
**enforced** `state_machine` validation rule.

Before this change a record state machine could be declared three ways (a
`workflow` metadata type, an `object.stateMachines` map, or a `state_machine`
validation rule) and **none of them were enforced at runtime** — a declarative
guardrail that was pure decoration, and a hallucination trap for AI authors.

**Enforcement (`@objectstack/objectql`)**
- New `validation/rule-validator.ts` evaluates the object's `validations` union
  on the write path: `evaluateValidationRules`, `needsPriorRecord`, and the
  `legalNextStates` introspection helper (all exported from the package root).
- `state_machine` rules reject illegal `field` transitions on update (with the
  rule's `message`); `script` / `cross_field` predicate rules now also fire
  (they were silently broken on PATCH updates because only the patch, not the
  prior record, was available). The engine plumbs the prior record into
  rule evaluation on single-row update; multi-row (`updateMany`) updates log a
  warning and skip rule evaluation rather than enforce on incomplete data.

**Convergence / retirement (`@objectstack/spec`) — breaking**
- Retires the `workflow` metadata type (removed from the metadata-type enum,
  the registry, the schema map, the `workflows` collection key, and the
  plural→singular mapping).
- Removes the `object.stateMachines` map and the `stack.workflows` array. The
  `state_machine` validation rule is the single canonical home.
- The XState-style `StateMachineSchema` file is **kept** (still used by the
  agent conversation lifecycle and the discovery protocol); only its role as
  the `workflow` metadata-type backing schema was removed. The optional
  `workflow` **RPC service** surface (`CoreServiceName.workflow`,
  `/api/v1/workflow`, `IWorkflowService`) is kept as a documented follow-up.

**Introspection (`@objectstack/runtime`)**
- Adds `GET /metadata/objects/:name/state/:field?from=:state`, returning the
  legal next states for a field (`next: null` when no FSM governs the field,
  `[]` for a declared dead-end) so UIs/agents read the transition table instead
  of re-deriving it.

**Surfaces (`@objectstack/platform-objects`, `@objectstack/cli`)**
- Studio drops the standalone "Workflow Rules" nav (state machines are edited
  alongside the object's other validation rules).
- `explain` no longer lists `workflow` as a related metadata type.

Migration: replace a `workflow` / `StateMachineConfig` declaration with a
`state_machine` validation rule on the object (`field` + `{ from: [allowedTo] }`
transition table), and move any side-effecting actions (emails, task creation)
into a record-triggered or scheduled Flow (ADR-0019). See the migrated
`examples/app-crm` flows for the pattern.
