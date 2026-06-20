// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * New Project Wizard — a multi-step (wizard) form surface. The showcase
 * defines wizard/tabbed/split form view *types* but had no page that actually
 * walks a user through a stepped create flow. This renders `object-form` with
 * `formType: 'wizard'` directly: Basics → Status → Budget, with a step
 * indicator, over showcase_project.
 */
export const NewProjectWizardPage: Page = {
  name: 'showcase_new_project_wizard',
  label: 'New Project (Wizard)',
  type: 'app',
  kind: 'full',
  template: 'default',
  isDefault: false,
  regions: [
    {
      name: 'main',
      width: 'large',
      components: [
        {
          type: 'object-form',
          properties: {
            objectName: 'showcase_project',
            mode: 'create',
            formType: 'wizard',
            showStepIndicator: true,
            title: 'Create a Project',
            description: 'A three-step wizard — basics, status, then budget & schedule.',
            sections: [
              { label: 'Basics', description: 'Name the project and bind its account.', fields: ['name', 'account', 'owner'] },
              { label: 'Status & Health', description: 'Where does it stand today?', fields: ['status', 'health'] },
              { label: 'Budget & Schedule', description: 'Money and dates.', fields: ['budget', 'spent', 'start_date', 'end_date'] },
            ],
          },
        },
      ],
    },
  ],
};
