// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/spec/contracts/approval-service
 *
 * Cross-package contract for the approval runtime. The default
 * implementation lives in `@objectstack/plugin-approvals` and is registered
 * as the `approvals` service.
 *
 * ADR-0019: approval is no longer a standalone engine. An approval is a
 * **flow node** (`type: 'approval'`) — the flow opens a request on the node
 * and suspends; a human decision finalises it and resumes the flow down the
 * matching `approve` / `reject` edge. This service owns the runtime state
 * (`sys_approval_request` / `sys_approval_action`, approver resolution, record
 * lock, status mirror) and the decision API. There is no standalone process
 * authoring type, submit, or step machinery anymore.
 */

import type { SharingExecutionContext } from './sharing-service.js';

/** Lifecycle state of an approval request. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'recalled';

/** Live request row. */
export interface ApprovalRequestRow {
  id: string;
  /** Origin of the request — `flow:<flowName|nodeId>` for node-driven approvals. */
  process_name: string;
  object_name: string;
  record_id: string;
  submitter_id?: string;
  submitter_comment?: string;
  status: ApprovalStatus;
  /** The flow node id that opened the request (mirrors `flow_node_id`). */
  current_step?: string;
  current_step_index?: number;
  pending_approvers?: string[];
  payload?: unknown;
  /** ADR-0019 correlation: the suspended flow run this request belongs to. */
  flow_run_id?: string;
  flow_node_id?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
}

/** Audit row. */
export interface ApprovalActionRow {
  id: string;
  request_id: string;
  step_name?: string;
  step_index?: number;
  action: 'submit' | 'approve' | 'reject' | 'recall' | 'escalate';
  actor_id?: string;
  comment?: string;
  created_at?: string;
}

/** Input for a decision on an approval request. */
export interface ApprovalDecisionInput {
  decision: 'approve' | 'reject';
  actorId: string;
  comment?: string;
}

/** Result of a decision that resumes the owning flow when finalised. */
export interface ApprovalDecisionResult {
  request: ApprovalRequestRow;
  /** True when this call moved the request to a terminal state. */
  finalized: boolean;
  decision: 'approve' | 'reject';
  /** The suspended flow run that was (or will be) resumed, if any. */
  runId?: string | null;
  /** True when the owning flow run was resumed as a result of this decision. */
  resumed?: boolean;
}

/**
 * Public contract — the node-era approval runtime.
 */
export interface IApprovalService {
  /**
   * "My approvals" inbox. Supports filtering by status, target object,
   * record id, or by the user expected to act next.
   */
  listRequests(
    filter: {
      object?: string;
      recordId?: string;
      status?: ApprovalStatus | ApprovalStatus[];
      approverId?: string;
      submitterId?: string;
    } | undefined,
    context: SharingExecutionContext,
  ): Promise<ApprovalRequestRow[]>;

  getRequest(requestId: string, context: SharingExecutionContext): Promise<ApprovalRequestRow | null>;

  /**
   * Record a decision on a node-driven request. Honours the node's
   * `unanimous` behaviour, finalises the request when satisfied, and resumes
   * the owning flow run down the matching `approve` / `reject` edge.
   */
  decide(requestId: string, input: ApprovalDecisionInput, context: SharingExecutionContext): Promise<ApprovalDecisionResult>;

  /** Audit trail for a request. */
  listActions(requestId: string, context: SharingExecutionContext): Promise<ApprovalActionRow[]>;
}
