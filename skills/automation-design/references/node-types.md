# Automation Design — Node & Event Reference

> Auto-derived from `packages/spec/src/automation/flow.zod.ts` and related schemas.
> This file is for quick reference only. The Zod source is the single source of truth.

## Flow Types

| Type | Description |
|:-----|:------------|
| `autolaunched` | No user interaction — event/API triggered |
| `screen` | Interactive — presents UI screens |
| `schedule` | Cron-based (daily, weekly, …) |
| `record_triggered` | Fires on record create/update/delete |
| `platform_event` | Fires on webhooks / message queue events |

## Flow Node Types (18)

### Control Flow

| Node | Description |
|:-----|:------------|
| `start` | Entry point (exactly one per flow) |
| `end` | Exit point (can have multiple) |
| `decision` | Conditional branching (if/else/switch) |
| `loop` | Iterate over a collection |
| `parallel_gateway` | Fork into parallel branches |
| `join_gateway` | Synchronise parallel branches |
| `wait` | Pause until condition or time |
| `boundary_event` | Attach to node — fires on timeout/error |
| `subflow` | Invoke another flow |

### Data Operations

| Node | Description |
|:-----|:------------|
| `assignment` | Set variable values |
| `create_record` | Insert a new record |
| `update_record` | Modify existing records |
| `delete_record` | Remove records |
| `query_record` | Fetch records with filters |

### External Integration

| Node | Description |
|:-----|:------------|
| `http_request` | Call external HTTP API |
| `connector_action` | Pre-built integration connector |
| `script` | Custom JavaScript/TypeScript |
| `screen` | Display UI form (screen flows only) |

## Trigger Events

| Event | Description |
|:------|:------------|
| `before_insert` | Before record created (can modify/reject) |
| `after_insert` | After record created |
| `before_update` | Before record updated |
| `after_update` | After record updated |
| `before_delete` | Before record deleted |
| `after_delete` | After record deleted |

## State Machine Config

| Property | Description |
|:---------|:------------|
| `field` | State field name (e.g., `status`) |
| `states` | Map of state names → config (`initial`, `final` flags) |
| `transitions` | Array of `{ from, to, trigger, guard?, actions? }` |

## Approval Process Properties

| Property | Description |
|:---------|:------------|
| `entryCondition` | Formula that determines when approval starts |
| `steps` | Ordered approval steps |
| `steps[].assignTo` | `{ type: 'field'|'role'|'user', ... }` |
| `steps[].escalation` | `{ timeout, action }` |
| `onApproved` | Actions when fully approved |
| `onRejected` | Actions when rejected |
