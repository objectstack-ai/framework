// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';

/** Escalate Case */
export const EscalateCaseAction: Action = {
  name: 'escalate_case',
  label: 'Escalate Case',
  objectName: 'case',
  icon: 'alert-triangle',
  type: 'modal',
  target: 'escalate_case_modal',
  locations: ['record_header', 'list_item'],
  visible: 'is_escalated == false AND is_closed == false',
  params: [
    {
      name: 'reason',
      label: 'Escalation Reason',
      type: 'textarea',
      required: true,
    }
  ],
  confirmText: 'This will escalate the case to the escalation team. Continue?',
  successMessage: 'Case escalated successfully!',
  refreshAfter: true,
};

/** Close Case */
export const CloseCaseAction: Action = {
  name: 'close_case',
  label: 'Close Case',
  objectName: 'case',
  icon: 'check-circle',
  type: 'modal',
  target: 'close_case_modal',
  locations: ['record_header'],
  visible: 'is_closed == false',
  params: [
    {
      name: 'resolution',
      label: 'Resolution',
      type: 'textarea',
      required: true,
    }
  ],
  confirmText: 'Are you sure you want to close this case?',
  successMessage: 'Case closed successfully!',
  refreshAfter: true,
};
