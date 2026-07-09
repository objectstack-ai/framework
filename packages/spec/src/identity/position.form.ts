// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineForm } from '../ui/view.zod';

/**
 * Position — canonical FormView layout.
 *
 * Positions are flat capability-distribution groups (ADR-0090 D3): name,
 * label, optional description. No hierarchy — the org tree lives on
 * business units. Single section is enough; the FormView gives the editor
 * friendly labels and required markers.
 */
export const positionForm = defineForm({
  schemaId: 'position',
  type: 'simple',
  sections: [
    {
      label: 'Position',
      description:
        'A position is a flat, assignable bundle of permission sets (e.g. sales_rep, sales_manager). Capability lives on permission sets; visibility depth lives on the business-unit tree.',
      columns: 2,
      fields: [
        { field: 'name', required: true, helpText: 'snake_case' },
        { field: 'label', required: true },
        { field: 'description', colSpan: 2 },
      ],
    },
  ],
});
