// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Role — canonical FormView layout.
 *
 * Roles are simple: name, label, optional parent, optional description.
 * Single section is enough — we still use a FormView so the editor
 * picks up the friendly labels and required markers.
 */
export const roleForm = defineForm({
  schemaId: 'role',
  type: 'simple',
  sections: [
    {
      label: 'Role',
      description:
        'Roles compose a hierarchy used for record sharing (sales VP → sales mgr → sales rep). Permissions themselves live on Permission Sets and Profiles.',
      columns: 2,
      fields: [
        { field: 'name', required: true, helpText: 'snake_case' },
        { field: 'label', required: true },
        {
          field: 'parent',
          helpText: 'Parent role machine name (Reports To)',
          colSpan: 2,
        },
        { field: 'description', colSpan: 2 },
      ],
    },
  ],
});
