---
title: "Tour · Automation"
description: Guided tour of the automation domain — flows (with approvals), scheduled jobs, webhooks, and connector actions.
---

# Guided tour — Automation

Everything in this domain lives under `src/automation/`.

## Flows

`src/automation/flows/` is the largest module in the showcase: record-change
flows, a screen wizard, an approval chain (approvals are **nodes inside a
flow**, ADR-0019 — there is no separate approval metadata type), scheduled
flows, and connector actions.

The reassignment wizard, projected at the business altitude (technical
nodes folded away):

```metadata
type: flow
name: showcase_reassign_wizard
detail: business
```

Trigger the automation yourself: complete a Task (Mark Done) and watch the
`showcase_task_completed` flow fire; submit a Project budget over the
threshold and the `showcase_budget_approval` chain lands in **Workspace →
Approvals**.

> **Heads-up:** completing one task fires **six** flows on purpose — each
> teaches a different mechanism for the same trigger (script side-effect,
> Slack connector, REST connector, subflow reuse, parallel fan-out,
> try/catch resilience). Watch the Runs panel to see them all land from a
> single record change; a real app would consolidate these.

## Jobs, webhooks, connectors

- `src/automation/jobs/` — interval/cron jobs behind the schedule trigger
  (the `job` capability token wires the timing backend).
- `src/automation/webhooks/` — inbound webhook endpoints.
- Connector flows (`showcase_task_completed_rest_ping`,
  `showcase_task_completed_slack`) dispatch through **live connectors**
  registered by `ConnectorRestPlugin` / `ConnectorSlackPlugin` in
  `objectstack.config.ts` — the delivered way to wire connectors (a purely
  declarative `connectors:` stack entry is inert today; the coverage
  manifest waives it with the tracking issue).

Continue with the [System tour](./showcase_tour_system.md), or go back to
the [overview](./showcase_index.md).
