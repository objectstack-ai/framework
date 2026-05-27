// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Workflow Metadata Form
 * 
 * Form layout for creating/editing declarative workflow rule metadata definitions.
 */
export const workflowForm = defineForm({
  schemaId: 'workflow',
  type: 'simple',
  sections: [
    {
      label: 'Basics',
      description: 'Identity and the object/event that triggers it.',
      columns: 2,
      fields: [
        { field: 'name', required: true, colSpan: 1, helpText: 'Unique identifier (snake_case)' },
        { field: 'objectName', widget: 'ref:object', required: true, colSpan: 1, helpText: 'Which object triggers this workflow' },
        { field: 'triggerType', required: true, colSpan: 1, helpText: 'When to run: on_create, on_update, on_delete, schedule' },
        { field: 'active', colSpan: 1, helpText: 'Enable/disable this workflow' },
        { field: 'description', widget: 'textarea', colSpan: 2, helpText: 'What this workflow does' },
        { field: 'criteria', widget: 'textarea', colSpan: 2, helpText: 'CEL expression: only run when this condition is true' },
      ],
    },
    {
      label: 'Actions',
      description: 'What this workflow does when fired.',
      fields: [
        { field: 'actions', type: 'repeater', helpText: 'Actions to execute immediately (field update, email, API call, etc.)' },
        { field: 'timeTriggers', type: 'repeater', helpText: 'Scheduled actions (e.g., send reminder 1 day before deadline)' },
      ],
    },
    {
      label: 'Advanced',
      description: 'Ordering and execution behaviour.',
      collapsible: true,
      collapsed: true,
      fields: [
        { field: 'executionOrder', helpText: 'Run order when multiple workflows match (lower = earlier)' },
      ],
    },
  ],
});
