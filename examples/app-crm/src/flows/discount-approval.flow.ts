// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Flow } from '@objectstack/spec/automation';

/**
 * Discount approval — ADR-0019 approval-as-flow-node.
 *
 * What used to be a standalone two-step approval *process* is now an ordinary
 * autolaunched flow with two `approval` nodes. The flow suspends on each
 * approval and resumes down the matching `approve` / `reject` edge:
 *
 *   start → manager_review ──approve──▶ finance_review ──approve──▶ end
 *                          └─reject──▶ rejected                └─reject──▶ rejected
 *
 * Finance only signs off when the discount exceeds 30% — that gate is just a
 * decision node on the approve edge out of the manager step.
 */
export const DiscountApprovalFlow: Flow = {
  name: 'crm_discount_approval',
  label: 'Opportunity Discount Approval',
  description: 'Two-step approval for opportunities with significant discounts.',
  type: 'autolaunched',

  nodes: [
    {
      id: 'start',
      type: 'start',
      label: 'On Discount Above Threshold',
      config: {
        objectName: 'crm_opportunity',
        triggerType: 'record-after-update',
        condition: 'discount_percent > 20',
      },
    },
    {
      id: 'manager_review',
      type: 'approval',
      label: 'Manager Review',
      config: {
        approvers: [{ type: 'role', value: 'sales_manager' }],
        behavior: 'first_response',
        lockRecord: true,
        approvalStatusField: 'approval_status',
      },
    },
    {
      id: 'needs_finance',
      type: 'decision',
      label: 'Discount Above 30%?',
      config: { condition: 'discount_percent > 30' },
    },
    {
      id: 'finance_review',
      type: 'approval',
      label: 'Finance Review',
      config: {
        approvers: [{ type: 'role', value: 'finance_approver' }],
        behavior: 'unanimous',
        lockRecord: true,
        approvalStatusField: 'approval_status',
      },
    },
    { id: 'approved', type: 'end', label: 'Approved' },
    { id: 'rejected', type: 'end', label: 'Rejected' },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'manager_review' },
    { id: 'e2', source: 'manager_review', target: 'needs_finance', label: 'approve' },
    { id: 'e3', source: 'manager_review', target: 'rejected', label: 'reject' },
    { id: 'e4', source: 'needs_finance', target: 'finance_review', label: 'true' },
    { id: 'e5', source: 'needs_finance', target: 'approved', label: 'false' },
    { id: 'e6', source: 'finance_review', target: 'approved', label: 'approve' },
    { id: 'e7', source: 'finance_review', target: 'rejected', label: 'reject' },
  ],
};
