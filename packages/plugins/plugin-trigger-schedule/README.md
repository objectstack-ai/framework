# @objectstack/plugin-trigger-schedule

Auto-launch ObjectStack flows on a schedule (cron / interval / once).

The automation engine ships the `FlowTrigger` extension point and the wiring
that turns a flow's `start` node into a normalized trigger binding — but the
*concrete* schedule trigger lives here, as a plugin. It delegates timing to the
platform `IJobService` (the `'job'` service), so it stays adapter-agnostic: the
job service selects a cron-capable adapter (e.g. the durable `DbJobAdapter` or
`CronJobAdapter`) for cron schedules and the interval adapter for the rest.

This is the sibling of `@objectstack/plugin-trigger-record-change` — same
engine baseline, a different event source.

## What it does

A flow whose `start` node declares a schedule:

```ts
{
  type: 'start',
  config: {
    schedule: { type: 'cron', expression: '0 1 * * *', timezone: 'UTC' },
    condition: "...", // optional start-condition gate
  },
}
// or simply: a flow with `type: 'schedule'` and a start-node schedule descriptor
```

auto-launches on that schedule — no manual `engine.execute()`. When it fires,
the flow runs with `event: 'schedule'` and `params: { jobId, flowName, schedule }`
in its context.

### Schedule shapes

`normalizeSchedule` accepts the canonical `JobSchedule` plus shorthands:

| Input                                          | Normalized                               |
| ---------------------------------------------- | ---------------------------------------- |
| `{ type: 'cron', expression, timezone? }`      | cron                                     |
| `'0 1 * * *'` (bare string)                    | `{ type: 'cron', expression: '0 1 * * *' }` |
| `{ cron }` / `{ expression }`                  | cron                                     |
| `{ type: 'interval', intervalMs }` / `{ every }` | interval                               |
| `{ type: 'once', at }` / `{ at }`              | once                                     |

## Usage

```ts
import { AutomationServicePlugin } from '@objectstack/service-automation';
import { JobServicePlugin } from '@objectstack/service-job';
import { ScheduleTriggerPlugin } from '@objectstack/plugin-trigger-schedule';

kernel
  .use(new AutomationServicePlugin())  // engine + flows
  .use(new JobServicePlugin())         // the 'job' service (cron/interval/db)
  .use(new ScheduleTriggerPlugin());   // ← makes schedule flows live
```

Depends on the job service plugin (`com.objectstack.service.job`) so its
`kernel:ready` adapter upgrade runs first; the job service is nonetheless
resolved lazily per bind, so adapter upgrades are always picked up. If the
automation or job service is unavailable, the plugin logs a warning and no-ops
rather than failing startup.

## Error isolation

A flow that throws during a scheduled run is logged and swallowed — it never
crashes the job runner.
