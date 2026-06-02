// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineFlow } from '@objectstack/spec';

/**
 * Task Completed → Notify — an autolaunched, record-triggered flow that fires
 * when a task transitions to Done and emails the project owner.
 */
export const TaskCompletedFlow = defineFlow({
  name: 'showcase_task_completed',
  label: 'Notify on Task Completed',
  description: 'Emails the project owner when a task is marked Done.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Update',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'status == "done" && previous.status != "done"',
      },
    },
    {
      id: 'notify',
      type: 'script',
      label: 'Send Completion Email',
      config: {
        actionType: 'email',
        inputs: {
          to: '{record.project.owner}',
          subject: '✅ Task done: {record.title}',
          template: 'showcase_task_done_email',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'notify' },
    { id: 'e2', source: 'notify', target: 'end' },
  ],
});

/**
 * Reassign Wizard — a screen flow launched from the Tasks toolbar action
 * (`showcase_bulk_reassign`). Collects a new assignee and writes it back.
 */
export const ReassignWizardFlow = defineFlow({
  name: 'showcase_reassign_wizard',
  label: 'Reassign Task',
  description: 'Screen flow that reassigns a task to a new owner.',
  type: 'screen',
  status: 'active',
  runAs: 'user',
  variables: [
    { name: 'recordId', type: 'text', isInput: true, isOutput: false },
    { name: 'new_assignee', type: 'text', isInput: true, isOutput: false },
  ],
  nodes: [
    { id: 'start', type: 'start', label: 'Start' },
    {
      id: 'collect',
      type: 'screen',
      label: 'New Assignee',
      config: {
        fields: [
          { name: 'new_assignee', label: 'New Assignee', type: 'text', required: true },
        ],
      },
    },
    {
      id: 'apply',
      type: 'update_record',
      label: 'Apply Reassignment',
      config: {
        objectName: 'showcase_task',
        filter: { id: '{recordId}' },
        fields: { assignee: '{new_assignee}' },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'collect' },
    { id: 'e2', source: 'collect', target: 'apply' },
    { id: 'e3', source: 'apply', target: 'end' },
  ],
});

/**
 * Task Assigned → Notify Assignee — the worked `notify` example (ADR-0012).
 *
 * Where {@link TaskCompletedFlow} hand-waves notification through a `script`
 * node, this flow uses the baseline `notify` node: it hands a topic +
 * recipient + message to the messaging service, which fans out to the user's
 * channels (inbox by default). The `notify` node ships in every automation
 * engine; delivery is backed by `@objectstack/service-messaging`
 * (`MessagingServicePlugin`). Without that plugin the node degrades to a
 * logged no-op instead of failing the flow — install it and this flow starts
 * landing inbox rows with no edit.
 */
export const TaskAssignedNotifyFlow = defineFlow({
  name: 'showcase_task_assigned_notify',
  label: 'Notify Assignee on Task Assignment',
  description: 'Notifies the new assignee (inbox channel) when a task is reassigned.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Assignee Change',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'assignee != previous.assignee',
      },
    },
    {
      id: 'notify_assignee',
      type: 'notify',
      label: 'Notify Assignee',
      config: {
        topic: 'task.assigned',
        recipients: ['{record.assignee}'],
        channels: ['inbox'],
        severity: 'info',
        title: 'New task assigned: {record.title}',
        message: 'You have been assigned "{record.title}".',
        actionUrl: '/showcase_task/{record.id}',
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'notify_assignee' },
    { id: 'e2', source: 'notify_assignee', target: 'end' },
  ],
});

/**
 * Project Budget Approval — ADR-0019 approval-as-flow-node.
 *
 * What used to be a standalone two-step approval *process* is now an ordinary
 * autolaunched flow with two `approval` nodes. The flow suspends on each
 * approval and resumes down the matching `approve` / `reject` edge. The
 * executive step only runs for budgets above $500k — that gate is a decision
 * node on the manager step's approve edge.
 */
export const BudgetApprovalFlow = defineFlow({
  name: 'showcase_budget_approval',
  label: 'Project Budget Approval',
  description: 'Two-step approval for projects above budget thresholds.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Large Budget',
      config: {
        objectName: 'showcase_project',
        triggerType: 'record-after-update',
        condition: 'budget > 100000',
      },
    },
    {
      id: 'manager_review',
      type: 'approval',
      label: 'Manager Review',
      config: {
        approvers: [{ type: 'role', value: 'manager' }],
        behavior: 'first_response',
        lockRecord: true,
      },
    },
    {
      id: 'needs_exec',
      type: 'decision',
      label: 'Budget Above $500k?',
      config: { condition: 'budget > 500000' },
    },
    {
      id: 'exec_review',
      type: 'approval',
      label: 'Executive Review',
      config: {
        approvers: [{ type: 'role', value: 'exec' }],
        behavior: 'unanimous',
        lockRecord: true,
      },
    },
    { id: 'approved', type: 'end', label: 'Approved' },
    { id: 'rejected', type: 'end', label: 'Rejected' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'manager_review' },
    { id: 'e2', source: 'manager_review', target: 'needs_exec', label: 'approve' },
    { id: 'e3', source: 'manager_review', target: 'rejected', label: 'reject' },
    // Decision branching is edge-condition driven (flow spec): the engine
    // routes a decision node by evaluating each out-edge's `condition`. Carry
    // the predicate on the edges (the node `config.condition` alone is not
    // evaluated by the engine), so budgets ≤ $500k skip the executive step.
    { id: 'e4', source: 'needs_exec', target: 'exec_review', label: 'true', condition: 'budget > 500000' },
    { id: 'e5', source: 'needs_exec', target: 'approved', label: 'false', condition: 'budget <= 500000' },
    { id: 'e6', source: 'exec_review', target: 'approved', label: 'approve' },
    { id: 'e7', source: 'exec_review', target: 'rejected', label: 'reject' },
  ],
});

/**
 * Task Completed → Post to Slack — the worked `connector_action` example
 * (ADR-0018 §Addendum, ADR-0022).
 *
 * Unlike {@link TaskCompletedFlow}, which hand-waves notification via a `script`
 * node, this flow takes the "raw API call" path: a baseline `connector_action`
 * node dispatches to the `slack` connector's `chat.postMessage` action. The
 * `connector_action` node type is built into every automation engine; the
 * `slack` connector itself is contributed at runtime by the
 * `@objectstack/connector-slack` plugin (static bot-token auth). Load that
 * plugin in your stack and the node resolves; omit it and the step fails with a
 * clear "connector slack not registered" error rather than silently no-op'ing.
 *
 * The connector → action → input pickers the designer shows for this node are
 * fed by `GET /api/v1/automation/connectors`, which enumerates the live
 * registry (see `getConnectorDescriptors`).
 */
export const TaskCompletedSlackFlow = defineFlow({
  name: 'showcase_task_completed_slack',
  label: 'Post to Slack on Task Completed',
  description: 'Posts to a Slack channel via the slack connector when a task is marked Done.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Update',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'status == "done" && previous.status != "done"',
      },
    },
    {
      id: 'post_to_slack',
      type: 'connector_action',
      label: 'Post to #wins',
      connectorConfig: {
        connectorId: 'slack',
        actionId: 'chat.postMessage',
        input: {
          channel: 'C0WINS000',
          text: '✅ Task done: {record.title}',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'post_to_slack' },
    { id: 'e2', source: 'post_to_slack', target: 'end' },
  ],
});

/**
 * Scheduled Digest — the worked `schedule` trigger example.
 *
 * A `type: 'schedule'` flow whose start node carries an interval descriptor.
 * The automation engine parses that into a schedule binding; the schedule
 * trigger plugin (`@objectstack/plugin-trigger-schedule`, paired with the job
 * service) registers a job that fires this flow every interval. Each tick runs
 * the `notify` node, dropping a fresh `sys_inbox_message` row — so the
 * scheduled fire is observable end-to-end with no manual `engine.execute()`.
 *
 * Install `requires: ['automation', 'triggers', 'job', 'messaging']` and this
 * flow auto-launches on the interval.
 */
export const ScheduledDigestFlow = defineFlow({
  name: 'showcase_scheduled_digest',
  label: 'Scheduled Project Digest (interval)',
  description: 'Fires on a fixed interval and posts a digest to an inbox — demonstrates the schedule trigger.',
  type: 'schedule',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'Every 20s',
      config: {
        // Interval keeps the demo observable in-session; production digests
        // would use a cron expression, e.g. { type: 'cron', expression: '0 8 * * *' }.
        schedule: { type: 'interval', intervalMs: 20000 },
      },
    },
    {
      id: 'digest',
      type: 'notify',
      label: 'Post Digest to Inbox',
      config: {
        topic: 'project.digest',
        recipients: ['admin@objectos.ai'],
        channels: ['inbox'],
        severity: 'info',
        title: 'Scheduled project digest',
        message: 'Your periodic project digest is ready — open Projects for the latest health.',
        actionUrl: '/showcase_project',
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'digest' },
    { id: 'e2', source: 'digest', target: 'end' },
  ],
});

/**
 * Task Completed → REST Ping (self) — the worked `connector_action` example on
 * the generic `rest` connector.
 *
 * Where {@link TaskCompletedSlackFlow} targets the `slack` connector (which
 * needs a real bot token + channel), this flow dispatches to the `rest`
 * connector contributed by `@objectstack/connector-rest`, configured to point
 * at the running server itself. On task completion it issues
 * `GET /api/v1/health`; the request and its `{ status: 'ok' }` response are
 * captured on the flow run, so the connector dispatch is fully observable
 * without any external service or credentials.
 */
export const TaskCompletedRestPingFlow = defineFlow({
  name: 'showcase_task_completed_rest_ping',
  label: 'REST Ping on Task Completed',
  description: 'Calls the local server health endpoint via the rest connector when a task is marked Done.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Update',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'status == "done" && previous.status != "done"',
      },
    },
    {
      id: 'ping',
      type: 'connector_action',
      label: 'GET /api/v1/health',
      connectorConfig: {
        connectorId: 'rest',
        actionId: 'request',
        input: {
          method: 'GET',
          path: '/api/v1/health',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'ping' },
    { id: 'e2', source: 'ping', target: 'end' },
  ],
});

/**
 * Task Follow-up Reminder — the worked `wait` (durable timer) example.
 *
 * When a task is created, the flow pauses at a `wait` node for a fixed delay,
 * then reminds the assignee to update it. The `wait` node *suspends* the run
 * (ADR-0019 durable pause, like `screen`/`approval`); a one-shot job scheduled
 * via the job service (`{ type: 'once', at }`) resumes it when the timer
 * elapses — so the delayed reminder fires end-to-end with no manual
 * `engine.resume()`. Without a job service the run still suspends and can be
 * resumed by an external `resume(runId)` (it never silently no-ops).
 *
 * A short demo delay keeps it observable in-session; a production reminder would
 * use e.g. `timerDuration: 'P3D'`. Install
 * `requires: ['automation', 'triggers', 'job', 'messaging']`.
 */
export const TaskFollowUpFlow = defineFlow({
  name: 'showcase_task_follow_up',
  label: 'Task Follow-up Reminder (wait)',
  description: 'Waits a fixed delay after a task is created, then reminds the assignee — demonstrates the durable wait node.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Created',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-create',
      },
    },
    {
      id: 'hold',
      type: 'wait',
      label: 'Wait 1 min',
      // Timer wait: suspends the run, then a one-shot job resumes it after the
      // duration. ISO-8601 duration; production reminders would use e.g. 'P3D'.
      waitEventConfig: { eventType: 'timer', timerDuration: 'PT1M', onTimeout: 'continue' },
    },
    {
      id: 'remind',
      type: 'notify',
      label: 'Remind Assignee',
      config: {
        topic: 'task.followup',
        recipients: ['{record.assignee}'],
        channels: ['inbox'],
        severity: 'info',
        title: 'Follow up on: {record.title}',
        message: 'This task has been open for a while — please update its status.',
        actionUrl: '/showcase_task/{record.id}',
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'hold' },
    { id: 'e2', source: 'hold', target: 'remind' },
    { id: 'e3', source: 'remind', target: 'end' },
  ],
});

/**
 * Notify Owner — a reusable **subflow** (`template: true`). Other flows invoke
 * it through a `subflow` node, passing `ownerId` + `message`; it fans a
 * notification to the owner. Centralising "how we notify an owner" here means
 * callers don't duplicate the notify wiring.
 */
export const NotifyOwnerSubflow = defineFlow({
  name: 'showcase_notify_owner',
  label: 'Notify Owner (reusable subflow)',
  description: 'Reusable subflow: notifies a record owner. Invoked by other flows via a subflow node.',
  type: 'autolaunched',
  template: true,
  variables: [
    { name: 'ownerId', type: 'text', isInput: true },
    { name: 'message', type: 'text', isInput: true },
  ],
  nodes: [
    { id: 'start', type: 'start', label: 'Start' },
    {
      id: 'notify',
      type: 'notify',
      label: 'Notify Owner',
      config: {
        topic: 'project.notice',
        recipients: ['{ownerId}'],
        channels: ['inbox'],
        severity: 'info',
        title: 'Project update',
        message: '{message}',
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'notify' },
    { id: 'e2', source: 'notify', target: 'end' },
  ],
});

/**
 * Task Done → Notify Owner (subflow) — the worked `subflow` example. On task
 * completion it invokes {@link NotifyOwnerSubflow} via a `subflow` node, mapping
 * the task's owner + a message into the subflow's input variables.
 */
export const TaskDoneNotifyOwnerFlow = defineFlow({
  name: 'showcase_task_done_notify_owner',
  label: 'Task Done → Notify Owner (subflow)',
  description: 'On task completion, invokes the reusable notify-owner subflow — demonstrates subflow reuse.',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Done',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'status == "done" && previous.status != "done"',
      },
    },
    {
      id: 'call_notify',
      type: 'subflow',
      label: 'Notify Owner',
      config: {
        flowName: 'showcase_notify_owner',
        input: {
          ownerId: '{record.project.owner}',
          message: 'Task "{record.title}" is done.',
        },
        outputVariable: 'notifyResult',
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'call_notify' },
    { id: 'e2', source: 'call_notify', target: 'end' },
  ],
});

/**
 * Batch Reminders — demonstrates the ADR-0031 **structured loop container**.
 *
 * The `loop` node owns a bounded **body region** (`config.body`, a
 * single-entry/single-exit sub-graph) and iterates it over a collection: each
 * task is bound to `task` (and its index to `taskIndex`) in the enclosing
 * variable scope, and the body sends a reminder. A hard `maxIterations` guard
 * keeps iteration bounded. The loop node's ordinary out-edge (`→ end`) is the
 * after-loop continuation — the DAG invariant for ordinary edges is preserved.
 */
export const BatchRemindersFlow = defineFlow({
  name: 'showcase_batch_reminders',
  label: 'Batch Task Reminders (Loop)',
  description: 'Iterates a collection of tasks and sends a reminder for each (structured loop container, ADR-0031).',
  type: 'autolaunched',
  variables: [
    { name: 'tasks', type: 'list', isInput: true, isOutput: false },
  ],
  nodes: [
    { id: 'start', type: 'start', label: 'Start' },
    {
      id: 'loop_tasks',
      type: 'loop',
      label: 'For each task',
      config: {
        collection: '{tasks}',
        iteratorVariable: 'task',
        indexVariable: 'taskIndex',
        maxIterations: 500,
        body: {
          nodes: [
            {
              id: 'send_reminder',
              type: 'script',
              label: 'Send Reminder',
              config: {
                actionType: 'email',
                inputs: {
                  to: '{task.owner.email}',
                  subject: 'Reminder ({taskIndex}): {task.title}',
                  template: 'showcase_task_reminder_email',
                },
              },
            },
          ],
          edges: [],
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'loop_tasks' },
    { id: 'e2', source: 'loop_tasks', target: 'end' },
  ],
});

/**
 * Fan-out Notify — demonstrates the ADR-0031 **structured parallel block**.
 *
 * The `parallel` node declares two branch regions in `config.branches[]`; both
 * run concurrently in the enclosing variable scope and **join implicitly** at
 * block end (the engine continues once both complete). There is no
 * author-visible split/join gateway. The node's ordinary out-edge (`→ end`) is
 * the after-block continuation.
 */
export const FanOutNotifyFlow = defineFlow({
  name: 'showcase_fan_out_notify',
  label: 'Fan-out Notify (Parallel)',
  description: 'Notifies owner and watchers concurrently via a parallel block, joining before completion (ADR-0031).',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Completed',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'status == "done" && previous.status != "done"',
      },
    },
    {
      id: 'fan_out',
      type: 'parallel',
      label: 'Notify in parallel',
      config: {
        branches: [
          {
            name: 'Email the owner',
            nodes: [
              {
                id: 'email_owner',
                type: 'script',
                label: 'Email Owner',
                config: {
                  actionType: 'email',
                  inputs: { to: '{record.project.owner}', subject: '✅ Done: {record.title}' },
                },
              },
            ],
            edges: [],
          },
          {
            name: 'Post to Slack',
            nodes: [
              {
                id: 'slack_post',
                type: 'script',
                label: 'Slack Notify',
                config: {
                  actionType: 'slack',
                  inputs: { channel: '#tasks', text: 'Task done: {record.title}' },
                },
              },
            ],
            edges: [],
          },
        ],
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'fan_out' },
    { id: 'e2', source: 'fan_out', target: 'end' },
  ],
});

/**
 * Resilient Sync — demonstrates the ADR-0031 **try/catch/retry** construct.
 *
 * The `try_catch` node runs a protected `try` region (an outbound HTTP push);
 * on failure it retries with exponential backoff, and if it still fails the
 * `catch` region records the failure with the caught error bound to `$error`.
 * Both regions are single-entry/single-exit and run in the enclosing scope; the
 * node's ordinary out-edge (`→ end`) is the after-block continuation.
 */
export const ResilientSyncFlow = defineFlow({
  name: 'showcase_resilient_sync',
  label: 'Resilient Sync (Try/Catch/Retry)',
  description: 'Pushes a task to an external system, retrying on failure and recording errors via try/catch (ADR-0031).',
  type: 'autolaunched',
  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Task Completed',
      config: {
        objectName: 'showcase_task',
        triggerType: 'record-after-update',
        condition: 'status == "done" && previous.status != "done"',
      },
    },
    {
      id: 'guarded_push',
      type: 'try_catch',
      label: 'Push with retry',
      config: {
        retry: { maxRetries: 3, retryDelayMs: 1000, backoffMultiplier: 2, maxRetryDelayMs: 10000 },
        errorVariable: '$error',
        try: {
          nodes: [
            {
              id: 'push',
              type: 'http_request',
              label: 'Push to CRM',
              config: {
                url: 'https://api.example.com/v1/tasks',
                method: 'POST',
                body: { id: '{record.id}', title: '{record.title}', status: 'done' },
              },
            },
          ],
          edges: [],
        },
        catch: {
          nodes: [
            {
              id: 'record_failure',
              type: 'update_record',
              label: 'Flag Sync Failure',
              config: {
                objectName: 'showcase_task',
                filter: { id: '{record.id}' },
                fields: { sync_status: 'failed', sync_error: '{$error.message}' },
              },
            },
          ],
          edges: [],
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'guarded_push' },
    { id: 'e2', source: 'guarded_push', target: 'end' },
  ],
});

export const allFlows = [
  TaskCompletedFlow,
  ReassignWizardFlow,
  BudgetApprovalFlow,
  TaskCompletedSlackFlow,
  TaskAssignedNotifyFlow,
  ScheduledDigestFlow,
  TaskCompletedRestPingFlow,
  TaskFollowUpFlow,
  NotifyOwnerSubflow,
  TaskDoneNotifyOwnerFlow,
  BatchRemindersFlow,
  FanOutNotifyFlow,
  ResilientSyncFlow,
];
