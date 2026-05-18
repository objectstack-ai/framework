import { P } from '@objectstack/spec';
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/** Share escalated/critical cases with service managers */
export const CaseEscalationSharingRule = {
  name: 'case_escalation_sharing',
  label: 'Escalated Cases Sharing',
  object: 'case',
  type: 'criteria' as const,
  condition: P`record.priority == "critical" && record.is_closed == false`,
  accessLevel: 'edit' as const,
  sharedWith: { type: 'role_and_subordinates' as const, value: 'service_manager' },
};
