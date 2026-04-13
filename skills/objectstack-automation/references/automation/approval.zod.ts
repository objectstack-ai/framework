// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';

/**
 * Approval Step Approver Type
 */
export const ApproverType = z.enum([
  'user',           // Specific user(s)
  'role',           // Users with specific role
  'manager',        // Submitter's manager
  'field',          // User ID defined in a record field
  'queue'           // Data ownership queue
]);

/**
 * Approval Action Type
 * Actions to execute on transition
 */
export const ApprovalActionType = z.enum([
  'field_update',
  'email_alert',
  'webhook',
  'script',
  'connector_action' // Added for Zapier-style integrations
]);

/**
 * definition of an action to perform
 */
export const ApprovalActionSchema = z.object({
  type: ApprovalActionType,
  name: z.string().describe('Action name'),
  config: z.record(z.string(), z.unknown()).describe('Action configuration'),
  
  /** For connector actions */
  connectorId: z.string().optional(),
  actionId: z.string().optional(),
});

/**
 * Approval Process Step
 */
export const ApprovalStepSchema = z.object({
  name: SnakeCaseIdentifierSchema.describe('Step machine name'),
  label: z.string().describe('Step display label'),
  description: z.string().optional(),
  
  /** Entry criteria for this step */
  entryCriteria: z.string().optional().describe('Formula expression to enter this step'),
  
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
});

/**
 * Approval Process Protocol
 * 
 * Defines a complex review and approval cycle for a record.
 * Manages state locking, notifications, and transition logic.
 */
export const ApprovalProcessSchema = z.object({
  name: SnakeCaseIdentifierSchema.describe('Unique process name'),
  label: z.string().describe('Human readable label'),
  object: z.string().describe('Target Object Name'),
  
  active: z.boolean().default(false),
  description: z.string().optional(),
  
  /** Entry Criteria for the entire process */
  entryCriteria: z.string().optional().describe('Formula to allow submission'),
  
  /** Record Locking */
  lockRecord: z.boolean().default(true).describe('Lock record from editing during approval'),
  
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
});

export const ApprovalProcess = Object.assign(ApprovalProcessSchema, {
  create: <T extends z.input<typeof ApprovalProcessSchema>>(config: T) => config,
});

export type ApprovalProcess = z.infer<typeof ApprovalProcessSchema>;
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;
