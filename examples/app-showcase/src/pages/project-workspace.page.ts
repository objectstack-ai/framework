// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * Project Workspace — a master-detail (header + line items) entry scenario.
 *
 * Demonstrates the `object-master-detail-form` renderer (ObjectUI ADR-0001):
 * create a Project (parent) together with its Tasks (children) in one screen.
 * `showcase_task.project` is a `master_detail` field, so the children are
 * created with the parent FK set in a single client-orchestrated transaction.
 */
export const ProjectWorkspacePage: Page = {
  name: 'showcase_project_workspace',
  label: 'New Project + Tasks',
  type: 'app',
  template: 'default',
  kind: 'full',
  regions: [
    {
      name: 'header',
      width: 'full',
      components: [
        {
          type: 'page:header',
          properties: {
            title: 'New Project + Tasks',
            subtitle:
              'Master-detail entry — fill the project, add its tasks inline, and save them together.',
            icon: 'folder-plus',
          },
        },
      ],
    },
    {
      name: 'main',
      width: 'large',
      components: [
        {
          type: 'object-master-detail-form',
          properties: {
            objectName: 'showcase_project',
            mode: 'create',
            formType: 'simple',
            submitText: 'Create Project + Tasks',
            fields: ['name', 'account', 'status', 'health', 'budget', 'end_date'],
            details: [
              {
                title: 'Tasks',
                childObject: 'showcase_task',
                relationshipField: 'project',
                amountField: 'estimate_hours',
                addLabel: 'Add task',
                columns: [
                  { field: 'title', label: 'Title', type: 'text', required: true },
                  {
                    field: 'status',
                    label: 'Status',
                    type: 'select',
                    options: [
                      { label: 'Backlog', value: 'backlog' },
                      { label: 'To Do', value: 'todo' },
                      { label: 'In Progress', value: 'in_progress' },
                      { label: 'In Review', value: 'in_review' },
                      { label: 'Done', value: 'done' },
                    ],
                  },
                  {
                    field: 'priority',
                    label: 'Priority',
                    type: 'select',
                    options: [
                      { label: 'Low', value: 'low' },
                      { label: 'Medium', value: 'medium' },
                      { label: 'High', value: 'high' },
                      { label: 'Urgent', value: 'urgent' },
                    ],
                  },
                  { field: 'estimate_hours', label: 'Estimate (h)', type: 'number' },
                  { field: 'due_date', label: 'Due Date', type: 'date' },
                ],
              },
            ],
          },
        },
      ],
    },
  ],
};
