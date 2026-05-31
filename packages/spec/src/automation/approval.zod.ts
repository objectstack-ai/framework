// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';
import { ExpressionInputSchema } from '../shared/expression.zod';

/**
 * Approval Step Approver Type
 */
import { lazySchema } from '../shared/lazy-schema';
export const ApproverType = z.enum([
  'user',           // Specific user(s)
  'role',           // Users with specific role (sys_member.role)
  'team',           // Members of a flat collaboration team (sys_team)
  'department',     // Members of a department + all descendant departments (sys_department)
  'manager',        // Submitter's manager (sys_user.manager_id)
  'field',          // User ID defined in a record field
  'queue'           // Data ownership queue
]);

/**
 * Approval Action Type
 * Actions to execute on transition
 *
 * @deprecated ADR-0019 — actions are no longer attached to approval steps.
 * In the flow model, "on approve / on reject" work is expressed as the
 * downstream nodes wired to the Approval node's `approve` / `reject` out-edges
 * (any registered action node — http, notify, update_record, …). Retained only
 * until {@link ApprovalProcessSchema} is removed.
 */
export const ApprovalActionType = z.enum([
  'field_update',
  'email_alert',
  'webhook',
  'script',
  'connector_action', // Added for Zapier-style integrations
  'inbox_notify',     // M11.C15.B — write a sys_notification row
]);

/**
 * definition of an action to perform
 */
export const ApprovalActionSchema = lazySchema(() => z.object({
  type: ApprovalActionType,
  name: z.string().describe('Action name'),
  config: z.record(z.string(), z.unknown()).describe('Action configuration'),
  
  /** For connector actions */
  connectorId: z.string().optional(),
  actionId: z.string().optional(),
}));

/**
 * Approval Process Step
 */
export const ApprovalStepSchema = lazySchema(() => z.object({
  name: SnakeCaseIdentifierSchema.describe('Step machine name'),
  label: z.string().describe('Step display label'),
  description: z.string().optional(),
  
  /** Entry criteria for this step */
  entryCriteria: ExpressionInputSchema.optional().describe('Predicate (CEL) to enter this step.'),
  
  /** Who can approve */
  approvers: z.array(z.object({
    type: ApproverType,
    value: z.string().describe('User ID, Role Name, or Field Name')
  })).min(1).describe('List of allowed approvers'),
  
  /** Approval Logic */
  behavior: z.enum(['first_response', 'unanimous']).default('first_response')
    .describe('How to handle multiple approvers'),
    
  /** Rejection behavior */
  rejectionBehavior: z.enum(['reject_process', 'back_to_previous'])
    .default('reject_process').describe('What happens if rejected'),

  /** Actions */
  onApprove: z.array(ApprovalActionSchema).optional().describe('Actions on step approval'),
  onReject: z.array(ApprovalActionSchema).optional().describe('Actions on step rejection'),
}));

/**
 * Approval Process Protocol
 *
 * Defines a complex review and approval cycle for a record.
 * Manages state locking, notifications, and transition logic.
 *
 * @deprecated ADR-0019 — the standalone approval *authoring* type is collapsed
 * into Flow. An approval is now authored as a flow with one or more **Approval
 * nodes** (see {@link ApprovalNodeConfigSchema}); the engine rides its durable
 * pause. The process-level concepts re-home as follows:
 *   - `steps`            → successive Approval nodes on the canvas
 *   - `entryCriteria`    → the condition on the edge entering the node
 *   - `onApprove`/`onReject` → the nodes wired to the node's `approve`/`reject` edges
 *   - `rejectionBehavior: back_to_previous` → a back-edge to an earlier node
 *   - `lockRecord` / `approvalStatusField` / `escalation` / `behavior` / approvers
 *                        → {@link ApprovalNodeConfigSchema} node config
 * This schema is retained only for the migration window and will be removed.
 */
export const ApprovalProcessSchema = lazySchema(() => z.object({
  name: SnakeCaseIdentifierSchema.describe('Unique process name'),
  label: z.string().describe('Human readable label'),
  object: z.string().describe('Target Object Name'),
  
  active: z.boolean().default(false),
  description: z.string().optional(),
  
  /** Entry Criteria for the entire process */
  entryCriteria: ExpressionInputSchema.optional().describe('Predicate (CEL) to allow submission.'),
  
  /** Record Locking */
  lockRecord: z.boolean().default(true).describe('Lock record from editing during approval'),

  /**
   * M11.C15.B — name of a field on the business object where the
   * engine mirrors the request status (e.g. `'approval_status'`).
   * Values written: 'pending' | 'approved' | 'rejected' | 'recalled'
   * | 'not_submitted'. The field should be declared as readonly on
   * the object so users can filter / display it but not edit it.
   * If omitted, no status mirror is written and the engine only
   * exposes status via `sys_approval_request`.
   */
  approvalStatusField: z.string().optional().describe(
    'Field name on the business object to mirror the request status.',
  ),
  
  /** Steps */
  steps: z.array(ApprovalStepSchema).min(1).describe('Sequence of approval steps'),

  /** Escalation Configuration (SLA-based auto-escalation) */
  escalation: z.object({
    enabled: z.boolean().default(false).describe('Enable SLA-based escalation'),
    timeoutHours: z.number().min(1).describe('Hours before escalation triggers'),
    action: z.enum(['reassign', 'auto_approve', 'auto_reject', 'notify']).default('notify').describe('Action to take on escalation timeout'),
    escalateTo: z.string().optional().describe('User ID, role, or manager level to escalate to'),
    notifySubmitter: z.boolean().default(true).describe('Notify the original submitter on escalation'),
  }).optional().describe('SLA escalation configuration for pending approval steps'),
  
  /** Global Actions */
  onSubmit: z.array(ApprovalActionSchema).optional().describe('Actions on initial submission'),
  onFinalApprove: z.array(ApprovalActionSchema).optional().describe('Actions on final approval'),
  onFinalReject: z.array(ApprovalActionSchema).optional().describe('Actions on final rejection'),
  onRecall: z.array(ApprovalActionSchema).optional().describe('Actions on recall'),
}));

export const ApprovalProcess = Object.assign(ApprovalProcessSchema, {
  create: <T extends z.input<typeof ApprovalProcessSchema>>(config: T) => config,
});

export type ApprovalProcess = z.infer<typeof ApprovalProcessSchema>;
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

// ==========================================================================
// Approval as a Flow Node (ADR-0019, canonical)
// ==========================================================================

/**
 * Registry node type for the Approval node. The `plugin-approvals` package
 * registers an executor under this type (ADR-0018), so an approval rides the
 * one flow engine as a durable-pause node rather than a second engine.
 */
export const APPROVAL_NODE_TYPE = 'approval' as const;

/**
 * Canonical decisions an Approval node emits. The engine selects the
 * downstream branch by matching these against out-edge `label`s
 * (see {@link ApprovalNodeConfigSchema}).
 */
export const ApprovalDecision = z.enum(['approve', 'reject']);
export type ApprovalDecision = z.infer<typeof ApprovalDecision>;

/**
 * Edge labels an Approval node's out-edges use to declare which branch a
 * decision follows. `resume(runId, { branchLabel })` passes the matching
 * label so the engine continues down the right edge.
 */
export const APPROVAL_BRANCH_LABELS = {
  approve: 'approve',
  reject: 'reject',
} as const;

/** A single approver assignment on an Approval node. */
export const ApprovalNodeApproverSchema = lazySchema(() => z.object({
  type: ApproverType,
  /**
   * The approver reference, interpreted per `type`: a user id (`user`), role
   * name (`role`), team/department id (`team`/`department`), field name
   * holding a user id (`field`), or queue id (`queue`). Omitted for `manager`
   * (resolved from the submitter's `manager_id`).
   */
  value: z.string().optional().describe('User id / role / team / department / field / queue — per `type`'),
}));
export type ApprovalNodeApprover = z.infer<typeof ApprovalNodeApproverSchema>;

/**
 * Per-node SLA escalation — lowered from {@link ApprovalProcessSchema.escalation}
 * to the node, so each Approval step on the canvas carries its own SLA.
 */
export const ApprovalEscalationSchema = lazySchema(() => z.object({
  enabled: z.boolean().default(false).describe('Enable SLA-based escalation for this node'),
  timeoutHours: z.number().min(1).describe('Hours before escalation triggers'),
  action: z.enum(['reassign', 'auto_approve', 'auto_reject', 'notify']).default('notify')
    .describe('Action on escalation timeout'),
  escalateTo: z.string().optional().describe('User id, role, or manager level to escalate to'),
  notifySubmitter: z.boolean().default(true).describe('Notify the original submitter on escalation'),
}));
export type ApprovalEscalation = z.infer<typeof ApprovalEscalationSchema>;

/**
 * Config for an **Approval node** (`type: 'approval'`) on a flow — the ADR-0019
 * replacement for an {@link ApprovalStepSchema}. The node opens an approval
 * request on entry, suspends the run, and resumes down its `approve` / `reject`
 * out-edge once a decision is recorded.
 *
 * What does NOT live here (re-homed to the flow graph, by design):
 *  - **entry criteria** → the condition on the edge entering this node
 *  - **on-approve / on-reject actions** → the nodes wired to the
 *    `approve` / `reject` out-edges
 *  - **back-to-previous rejection** → a back-edge to an earlier node
 *
 * Approval *state* (request/action rows, record lock, status mirror) remains
 * first-class engine-adjacent state owned by `plugin-approvals`; this config
 * only describes how the node behaves.
 */
export const ApprovalNodeConfigSchema = lazySchema(() => z.object({
  /** Who may act on this step. */
  approvers: z.array(ApprovalNodeApproverSchema).min(1).describe('Allowed approvers for this node'),

  /** How multiple approvers combine. (Enterprise adds quorum/weighted — ADR-0019 tiering.) */
  behavior: z.enum(['first_response', 'unanimous']).default('first_response')
    .describe('How to combine multiple approvers'),

  /** Lock the triggering record from edits while this node is pending. */
  lockRecord: z.boolean().default(true).describe('Lock the record from editing while pending'),

  /**
   * Field on the business object to mirror the request status onto
   * (`pending`/`approved`/`rejected`/`recalled`). Should be readonly on the
   * object. Omitted ⇒ status is exposed only via `sys_approval_request`.
   */
  approvalStatusField: z.string().optional()
    .describe('Business-object field to mirror request status onto'),

  /** Optional per-node SLA escalation. */
  escalation: ApprovalEscalationSchema.optional().describe('Per-node SLA escalation'),
}));
export type ApprovalNodeConfig = z.infer<typeof ApprovalNodeConfigSchema>;
