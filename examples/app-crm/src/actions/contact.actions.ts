// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Action } from '@objectstack/spec/ui';

/** Mark Contact as Primary */
export const MarkPrimaryContactAction: Action = {
  name: 'mark_primary',
  label: 'Mark as Primary Contact',
  objectName: 'contact',
  icon: 'star',
  type: 'script',
  target: 'markAsPrimaryContact',
  locations: ['record_header', 'list_item'],
  visible: 'is_primary == false',
  confirmText: 'Mark this contact as the primary contact for the account?',
  successMessage: 'Contact marked as primary!',
  refreshAfter: true,
};

/** Send Email to Contact */
export const SendEmailAction: Action = {
  name: 'send_email',
  label: 'Send Email',
  objectName: 'contact',
  icon: 'mail',
  type: 'modal',
  target: 'sendEmail',
  locations: ['record_header', 'list_item'],
  visible: 'email_opt_out == false',
  params: [
    { name: 'subject', label: 'Subject', type: 'text', required: true },
    { name: 'body', label: 'Body', type: 'textarea', required: true },
  ],
  refreshAfter: false,
};
