---
name: automation-design
description: >
  Design ObjectStack automation (Flows, Workflows, Triggers, Approvals).
  Use when building visual logic flows, state machines, scheduled jobs,
  approval processes, or event-driven automations in an ObjectStack project.
license: Apache-2.0
compatibility: Requires @objectstack/spec Zod schemas (v4+)
metadata:
  author: objectstack-ai
  version: "1.0"
  domain: automation
  tags: flow, workflow, trigger, approval, state-machine
---

# Automation Design — ObjectStack Automation Protocol

Expert instructions for designing business automation using the ObjectStack
specification. This skill covers Flows (visual logic orchestration), Workflows
(state machines & approvals), Triggers (event-driven automation), and ETL
pipelines.

---

## When to Use This Skill

- You are building a **visual flow** (auto-launched, screen, or scheduled).
- You need a **state machine** or **approval process** for a business object.
- You are setting up **event-driven triggers** (record create/update/delete).
- You need **scheduled automation** (daily reports, data cleanup).
- You are designing an **ETL pipeline** for data synchronisation.

---

## Flows — Visual Logic Orchestration

A **Flow** is a directed graph of nodes that execute sequentially or in
parallel. Flows are the primary automation building block in ObjectStack.

### Flow Types

| Type | When to Use |
|:-----|:------------|
| `autolaunched` | Runs without user interaction — triggered by events, APIs, or other flows |
| `screen` | Interactive — presents UI screens to the user (wizards, forms) |
| `schedule` | Runs on a cron schedule (daily cleanup, weekly reports) |
| `record_triggered` | Fires automatically on record create/update/delete |
| `platform_event` | Fires on platform events (webhooks, message queue) |

### Flow Node Types

Flows are built from **18 node types**:

#### Control Flow

| Node | Purpose |
|:-----|:--------|
| `start` | Entry point — every flow has exactly one |
| `end` | Exit point — can have multiple (early exit, error exit) |
| `decision` | Conditional branching (if/else/switch) |
| `loop` | Iterate over a collection |
| `parallel_gateway` | Fork execution into parallel branches |
| `join_gateway` | Synchronise parallel branches back together |
| `wait` | Pause execution until a condition or time elapses |
| `boundary_event` | Attach to another node — fires on timeout or error |
| `subflow` | Invoke another flow (reusable composition) |

#### Data Operations

| Node | Purpose |
|:-----|:--------|
| `assignment` | Set variable values |
| `create_record` | Insert a new record |
| `update_record` | Modify existing records |
| `delete_record` | Remove records |
| `query_record` | Fetch records with filters |

#### External Integration

| Node | Purpose |
|:-----|:--------|
| `http_request` | Call an external HTTP API |
| `connector_action` | Invoke a pre-built integration connector |
| `script` | Execute custom JavaScript/TypeScript logic |
| `screen` | Display a UI form to the user (screen flows only) |

### Flow Variables

Every flow defines input/output variables:

```typescript
variables: {
  case_id: {
    type: 'text',
    label: 'Case ID',
    isInput: true,    // passed in when flow is invoked
    isOutput: false,
  },
  approval_result: {
    type: 'boolean',
    label: 'Approved?',
    isInput: false,
    isOutput: true,   // returned when flow completes
  },
}
```

### Flow Example — Auto-Escalate Overdue Cases

```typescript
{
  name: 'escalate_overdue_cases',
  type: 'schedule',
  schedule: '0 9 * * *',    // daily at 09:00
  nodes: [
    {
      id: 'start',
      type: 'start',
      next: 'find_overdue',
    },
    {
      id: 'find_overdue',
      type: 'query_record',
      config: {
        object: 'support_case',
        filter: [
          { field: 'status', operator: 'in', value: ['new', 'open'] },
          { field: 'due_date', operator: 'less_than', value: '$TODAY' },
        ],
      },
      next: 'loop_cases',
    },
    {
      id: 'loop_cases',
      type: 'loop',
      config: { collection: '$find_overdue.records' },
      next: 'update_status',
      afterLoop: 'notify_manager',
    },
    {
      id: 'update_status',
      type: 'update_record',
      config: {
        object: 'support_case',
        recordId: '$loop_cases.current.id',
        values: { status: 'escalated' },
      },
    },
    {
      id: 'notify_manager',
      type: 'http_request',
      config: {
        url: 'https://hooks.slack.com/services/...',
        method: 'POST',
        body: { text: 'Escalated $find_overdue.records.length overdue cases.' },
      },
      next: 'end',
    },
    { id: 'end', type: 'end' },
  ],
}
```

---

## Workflows — State Machines & Approvals

A **Workflow** defines the lifecycle of a record through states (statuses)
and the transitions between them.

### State Machine Configuration

```typescript
{
  name: 'case_lifecycle',
  field: 'status',       // the field that holds the state
  states: {
    new:       { label: 'New',       initial: true },
    open:      { label: 'Open' },
    escalated: { label: 'Escalated' },
    resolved:  { label: 'Resolved' },
    closed:    { label: 'Closed',    final: true },
  },
  transitions: [
    { from: 'new',       to: 'open',      trigger: 'assign' },
    { from: 'open',      to: 'escalated', trigger: 'escalate' },
    { from: 'open',      to: 'resolved',  trigger: 'resolve' },
    { from: 'escalated', to: 'open',      trigger: 'de_escalate' },
    { from: 'escalated', to: 'resolved',  trigger: 'resolve' },
    { from: 'resolved',  to: 'open',      trigger: 'reopen' },
    { from: 'resolved',  to: 'closed',    trigger: 'close' },
  ],
}
```

### Transition Guards

Transitions can have conditions that must be met:

```typescript
{
  from: 'open',
  to: 'resolved',
  trigger: 'resolve',
  guard: "resolution IS NOT NULL",    // formula condition
  actions: ['send_resolution_email'], // side-effect actions
}
```

### Approval Processes

Approvals are a specialised workflow pattern:

```typescript
{
  name: 'expense_approval',
  object: 'expense_report',
  entryCondition: "amount > 500",
  steps: [
    {
      name: 'manager_approval',
      assignTo: { type: 'field', field: 'manager' },
      action: 'approve_or_reject',
      escalation: { timeout: '48h', action: 'auto_approve' },
    },
    {
      name: 'finance_approval',
      condition: "amount > 5000",
      assignTo: { type: 'role', role: 'finance_manager' },
      action: 'approve_or_reject',
    },
  ],
  onApproved: { updateFields: { status: 'approved' } },
  onRejected: { updateFields: { status: 'rejected' }, notifySubmitter: true },
}
```

---

## Triggers — Event-Driven Automation

Triggers fire automatically when data events occur.

### Trigger Events

| Event | Fires When |
|:------|:-----------|
| `before_insert` | Before a record is created (can modify/reject) |
| `after_insert` | After a record is created |
| `before_update` | Before a record is updated |
| `after_update` | After a record is updated |
| `before_delete` | Before a record is deleted |
| `after_delete` | After a record is deleted |

### Trigger Configuration

```typescript
{
  name: 'notify_on_escalation',
  object: 'support_case',
  event: 'after_update',
  condition: "OLD.status != 'escalated' AND NEW.status = 'escalated'",
  action: {
    type: 'flow',
    flow: 'send_escalation_notification',
    input: { case_id: '$record.id' },
  },
}
```

> **`OLD`** and **`NEW`** are special variables available in update triggers,
> representing the record before and after the change.

---

## Best Practices

### Flow Design

1. **Keep flows small and composable.** Use `subflow` nodes to break complex
   logic into reusable parts.
2. **Always handle errors.** Add `boundary_event` nodes for timeout and error
   scenarios.
3. **Use variables for all dynamic values.** Never hard-code record IDs or
   API keys in node config.
4. **Prefer `query_record` over multiple `http_request` calls** when the data
   lives in ObjectStack.
5. **Set `timeoutMs` on HTTP nodes.** Default is generous; tighten it for
   critical paths.

### State Machine Design

1. **Mark exactly one state as `initial: true`.**
2. **Mark terminal states as `final: true`.**
3. **Define explicit transitions** — do not rely on implicit "any → any".
4. **Add guards** to transitions that require preconditions.
5. **Use `actions` on transitions** for side-effects (emails, notifications).

### Trigger Design

1. **Prefer `after_*` triggers** unless you need to modify/reject the record.
2. **Avoid infinite loops:** Do not update the same object in an `after_update`
   trigger without a guard condition.
3. **Use `condition`** to narrow when the trigger fires — avoid running
   expensive logic on every save.

---

## Common Pitfalls

1. **Circular flow references.** Flow A calls Flow B which calls Flow A. Use
   a depth counter or `visited` set to detect cycles.
2. **Unmatched `parallel_gateway` / `join_gateway`.** Every fork must have a
   corresponding join.
3. **Missing `end` node.** Every path through the flow must terminate.
4. **`before_*` trigger throwing unhandled errors.** This silently prevents
   the record operation — always provide a user-friendly error message.
5. **Scheduled flows without idempotency.** If the flow runs twice
   accidentally, the result should be the same.

---

## References

- [flow.zod.ts](./references/automation/flow.zod.ts) — Flow types, 18 node types, variables
- [workflow.zod.ts](./references/automation/workflow.zod.ts) — Workflow rules, trigger types, actions
- [trigger-registry.zod.ts](./references/automation/trigger-registry.zod.ts) — Trigger definitions
- [approval.zod.ts](./references/automation/approval.zod.ts) — Approval process, steps, escalation
- [state-machine.zod.ts](./references/automation/state-machine.zod.ts) — State machine transitions
- [execution.zod.ts](./references/automation/execution.zod.ts) — Execution state, history, scheduling
- [webhook.zod.ts](./references/automation/webhook.zod.ts) — Webhook triggers, delivery, retry
- [node-executor.zod.ts](./references/automation/node-executor.zod.ts) — Flow node execution runtime
- [Schema index](./references/_index.md) — All bundled schemas with dependency tree
