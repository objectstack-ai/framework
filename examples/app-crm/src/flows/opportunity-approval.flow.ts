// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type * as Automation from '@objectstack/spec/automation';
type Flow = Automation.Flow;

/** Opportunity Approval — multi-level approval for deals over $100K */
export const OpportunityApprovalFlow: Flow = {
  name: 'opportunity_approval',
  label: 'Large Deal Approval',
  description: 'Approval process for opportunities over $100K',
  type: 'record_change',

  variables: [
    { name: 'opportunityId', type: 'text', isInput: true, isOutput: false },
  ],

  nodes: [
    {
      id: 'start', type: 'start', label: 'Start',
      config: { objectName: 'opportunity', criteria: 'amount > 100000 AND stage = "proposal"' },
    },
    {
      id: 'get_opportunity', type: 'get_record', label: 'Get Opportunity',
      config: { objectName: 'opportunity', filter: { id: '{opportunityId}' }, outputVariable: 'oppRecord' },
    },
    {
      id: 'approval_step_manager', type: 'connector_action', label: 'Sales Manager Approval',
      connectorConfig: {
        connectorId: 'approval',
        actionId: 'request_approval',
        input: {
          approver: '{oppRecord.owner.manager}',
          emailTemplate: 'opportunity_approval_request',
          comments: 'required',
        },
      },
    } as any,
    {
      id: 'decision_manager', type: 'decision', label: 'Manager Approved?',
      config: { condition: '{approval_step_manager.result} == "approved"' },
    },
    {
      id: 'approval_step_director', type: 'connector_action', label: 'Sales Director Approval',
      connectorConfig: {
        connectorId: 'approval',
        actionId: 'request_approval',
        input: {
          approver: '{oppRecord.owner.manager.manager}',
          emailTemplate: 'opportunity_approval_request',
        },
      },
    } as any,
    {
      id: 'decision_director', type: 'decision', label: 'Director Approved?',
      config: { condition: '{approval_step_director.result} == "approved"' },
    },
    {
      id: 'mark_approved', type: 'update_record', label: 'Mark as Approved',
      config: {
        objectName: 'opportunity', filter: { id: '{opportunityId}' },
        fields: { approval_status: 'approved', approved_date: '{NOW()}' },
      },
    },
    {
      id: 'notify_approval', type: 'script', label: 'Send Approval Notification',
      config: { actionType: 'email', template: 'opportunity_approved', recipients: ['{oppRecord.owner}'] },
    },
    {
      id: 'notify_rejection', type: 'script', label: 'Send Rejection Notification',
      config: { actionType: 'email', template: 'opportunity_rejected', recipients: ['{oppRecord.owner}'] },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],

  edges: [
    { id: 'e1', source: 'start', target: 'get_opportunity', type: 'default' },
    { id: 'e2', source: 'get_opportunity', target: 'approval_step_manager', type: 'default' },
    { id: 'e3', source: 'approval_step_manager', target: 'decision_manager', type: 'default' },
    { id: 'e4', source: 'decision_manager', target: 'approval_step_director', type: 'default', condition: '{approval_step_manager.result} == "approved"', label: 'Approved' },
    { id: 'e5', source: 'decision_manager', target: 'notify_rejection', type: 'default', condition: '{approval_step_manager.result} != "approved"', label: 'Rejected' },
    { id: 'e6', source: 'approval_step_director', target: 'decision_director', type: 'default' },
    { id: 'e7', source: 'decision_director', target: 'mark_approved', type: 'default', condition: '{approval_step_director.result} == "approved"', label: 'Approved' },
    { id: 'e8', source: 'decision_director', target: 'notify_rejection', type: 'default', condition: '{approval_step_director.result} != "approved"', label: 'Rejected' },
    { id: 'e9', source: 'mark_approved', target: 'notify_approval', type: 'default' },
    { id: 'e10', source: 'notify_approval', target: 'end', type: 'default' },
    { id: 'e11', source: 'notify_rejection', target: 'end', type: 'default' },
  ],
};
