# @objectstack/plugin-trigger-record-change

Auto-launch ObjectStack flows on record changes.

The automation engine ships the `FlowTrigger` extension point and the wiring
that turns a flow's `start` node into a normalized trigger binding — but the
*concrete* record-change trigger lives here, as a plugin. This mirrors the
connector split (engine baseline + `connector-rest` plugin) and reuses the same
`kernel:ready` → `getService('objectql')` pattern `plugin-audit` uses to reach
the data engine's lifecycle-hook surface.

## What it does

A flow whose `start` node declares a record-change trigger:

```ts
{
  type: 'start',
  config: {
    objectName: 'showcase_task',
    triggerType: 'record-after-update',
    condition: "status == 'done' && previous.status != 'done'", // optional
  },
}
```

auto-launches whenever a matching mutation happens — no manual
`engine.execute()`. The engine evaluates the optional `condition` (the start
node gate) before running the flow, with `record` (the new row) and `previous`
(the old row) in scope.

### Trigger event → hook mapping

| `triggerType`            | ObjectQL hook  |
| ------------------------ | -------------- |
| `record-after-create`    | `afterInsert`  |
| `record-after-update`    | `afterUpdate`  |
| `record-after-delete`    | `afterDelete`  |
| `record-before-create`   | `beforeInsert` |
| `record-before-update`   | `beforeUpdate` |
| `record-before-delete`   | `beforeDelete` |

## Usage

```ts
import { AutomationServicePlugin } from '@objectstack/service-automation';
import { MessagingServicePlugin } from '@objectstack/service-messaging';
import { RecordChangeTriggerPlugin } from '@objectstack/plugin-trigger-record-change';

kernel
  .use(new AutomationServicePlugin())   // engine + flows
  .use(new MessagingServicePlugin())    // notify channels (optional)
  .use(new RecordChangeTriggerPlugin()); // ← makes record-change flows live
```

Requires the ObjectQL engine (`com.objectstack.engine.objectql`). If either the
automation service or the data engine is unavailable at `kernel:ready`, the
plugin logs a warning and no-ops rather than failing startup.

## Error isolation

A flow that throws during a triggered run is logged and swallowed — it never
breaks the CRUD write that triggered it.
