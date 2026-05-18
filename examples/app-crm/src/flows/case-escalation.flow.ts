// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type * as Automation from '@objectstack/spec/automation';
type Flow = Automation.Flow;

/** Case Escalation — auto-escalate high-priority cases */
export const CaseEscalationFlow: Flow = {
  name: 'case_escalation',
  label: 'Case Escalation Process',
  description: 'Automatically escalate high-priority cases',
  type: 'record_change',

  variables: [
    { name: 'caseId', type: 'text', isInput: true, isOutput: false },
  ],

  nodes: [
    {
      id: 'start', type: 'start', label: 'Start',
      config: { objectName: 'case', criteria: 'priority = "critical" OR (priority = "high" AND account.type = "customer")' },
    },
    {
      id: 'get_case', type: 'get_record', label: 'Get Case Record',
      config: { objectName: 'case', filter: { id: '{caseId}' }, outputVariable: 'caseRecord' },
    },
    {
      id: 'assign_senior_agent', type: 'update_record', label: 'Assign to Senior Agent',
      config: {
        objectName: 'case', filter: { id: '{caseId}' },
        fields: { owner: '{caseRecord.owner.manager}', is_escalated: true, escalated_date: '{NOW()}', status: 'escalated' },
      },
    },
    {
      id: 'create_task', type: 'create_record', label: 'Create Follow-up Task',
      config: {
        objectName: 'task',
        fields: {
          subject: 'Follow up on escalated case: {caseRecord.case_number}',
          related_to_type: 'case',
          related_to_case: '{caseId}',
          owner: '{caseRecord.owner}',
          priority: 'high', status: 'not_started', due_date: '{TODAY() + 1}',
        },
      },
    },
    {
      id: 'notify_team', type: 'script', label: 'Notify Support Team',
      config: {
        actionType: 'email',
        template: 'case_escalated',
        recipients: ['{caseRecord.owner}', '{caseRecord.owner.manager}', 'support-team@example.com'],
        variables: {
          caseNumber: '{caseRecord.case_number}',
          priority: '{caseRecord.priority}',
          accountName: '{caseRecord.account.name}',
        },
      },
    },
    { id: 'end', type: 'end', label: 'End' },
  ],

  edges: [
    { id: 'e1', source: 'start', target: 'get_case', type: 'default' },
    { id: 'e2', source: 'get_case', target: 'assign_senior_agent', type: 'default' },
    { id: 'e3', source: 'assign_senior_agent', target: 'create_task', type: 'default' },
    { id: 'e4', source: 'create_task', target: 'notify_team', type: 'default' },
    { id: 'e5', source: 'notify_team', target: 'end', type: 'default' },
  ],
};
