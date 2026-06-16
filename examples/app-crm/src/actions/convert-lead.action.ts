// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { UI } from '@objectstack/spec';

/**
 * Row-level action on crm_lead — launches the Convert Lead screen flow wizard.
 * Shown as a button in the lead list row menu and in the lead record header.
 */
export const ConvertLeadAction: UI.Action = {
  name: 'crm_convert_lead',
  label: 'Convert Lead',
  description: 'Open the Convert Lead wizard to create an Opportunity from this Lead.',
  icon: 'ArrowRightCircle',
  objectName: 'crm_lead',
  type: 'flow',
  target: 'crm_convert_lead_wizard',
  locations: ['list_item', 'record_header', 'record_more'],
  recordIdParam: 'recordId',
  // Conditional visibility (CEL): hide the action once the lead is already
  // converted — so the button disappears rather than the user clicking it and
  // hitting the flow's "already converted" guard screen. The flow keeps that
  // guard as a server-side backstop.
  visible: 'record.status != "converted"',
};
