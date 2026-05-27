// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * EmailTemplate — canonical FormView layout.
 *
 * Used for the `email_template` metadata type surfaced by the
 * notification service. Bodies are rendered with the `code` widget so
 * admins get syntax highlighting (HTML/Markdown/text via the
 * `bodyType` field).
 */
export const emailTemplateForm = defineForm({
  schemaId: 'email_template',
  type: 'simple',
  sections: [
    {
      label: 'Identity',
      description: 'Identifier and content type. The id is referenced by sendTemplate({ template: id, ... }).',
      columns: 2,
      fields: [
        { field: 'id', required: true, colSpan: 1, helpText: 'Template id (e.g. auth.password_reset)' },
        { field: 'bodyType', type: 'select', colSpan: 1, options: [
          { label: 'HTML', value: 'html' },
          { label: 'Plain text', value: 'text' },
          { label: 'Markdown', value: 'markdown' },
        ]},
      ],
    },
    {
      label: 'Subject',
      description: 'Subject line. Supports {{var.path}} interpolation.',
      columns: 1,
      fields: [
        { field: 'subject', required: true, widget: 'textarea' },
      ],
    },
    {
      label: 'Body',
      description: 'Email body. Use {{var}} for variables. Editor highlights based on body type.',
      columns: 1,
      fields: [
        { field: 'body', required: true, type: 'code', language: 'html', helpText: 'Body content. Will be rendered as HTML, plain text, or Markdown based on Body Type.' },
      ],
    },
    {
      label: 'Variables & Attachments',
      description: 'Declared template variables and optional file attachments.',
      columns: 1,
      fields: [
        { field: 'variables', type: 'tags', helpText: 'List of variable names referenced in subject/body' },
        { field: 'attachments', widget: 'json', helpText: '[{ "name": "...", "url": "..." }]' },
      ],
    },
  ],
});
