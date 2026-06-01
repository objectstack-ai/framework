---
"@objectstack/service-automation": minor
---

Implement the `subflow` node executor — invoke another flow as a reusable step.

The designer offered a `subflow` node but the engine had no executor, so a flow
using it couldn't run. `subflow` now:

- resolves `config.input` (a `{token}` mapping) against the parent's variables,
- runs `config.flowName` via `engine.execute(...)`, and
- writes the child's output back — under `${nodeId}.output`, and under
  `config.outputVariable` as a bare variable when given.

Scope (v1): **synchronous** subflows that run to completion. If the child
*suspends* (a nested `approval` / `screen` / `wait`), the node fails with a
clear message rather than silently dropping the run — nested durable pause is a
deliberate follow-up. A depth guard (16) turns an accidental recursive cycle
into a clean error instead of a stack overflow.

A bare `AutomationServicePlugin` now ships 14 executors including `subflow`.

Tests: `subflow-node.test.ts` — invoke + input-mapping + output capture,
missing `flowName`, child-not-found, child-suspended, recursion guard.
service-automation **118 passing**. Worked examples added to the showcase: a
reusable `showcase_notify_owner` subflow (`template: true`) invoked by
`showcase_task_done_notify_owner`.
