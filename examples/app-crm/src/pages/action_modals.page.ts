// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Action-target stub pages.
 *
 * Several modal-type actions in this CRM example declare `target: '<page_name>'`,
 * which (post-pages registration) is now strictly cross-validated by
 * `defineStack()`. Each target must resolve to a registered page.
 *
 * These stubs are minimal `blank`-type pages with a single placeholder card so
 * the validator passes and the existing modal UX continues to function. They
 * can later be fleshed out into real action forms without renaming.
 */

import type { Page } from '@objectstack/spec/ui';

const stub = (name: string, label: string, hint: string): Page => ({
  name,
  label,
  description: hint,
  type: 'blank',
  blankLayout: {
    columns: 12,
    rowHeight: 40,
    gap: 8,
    items: [],
  },
  regions: [
    {
      name: 'main',
      width: 'full',
      components: [
        {
          type: 'page:card',
          id: `${name}_placeholder`,
          label,
          properties: {
            title: label,
            bordered: true,
          },
        },
      ],
    },
  ],
});

export const EscalateCasePage = stub(
  'escalate_case',
  'Escalate Case',
  'Modal stub for the case escalation action.',
);

export const CloseCasePage = stub(
  'close_case',
  'Close Case',
  'Modal stub for the case close action.',
);

export const CreateCampaignPage = stub(
  'create_campaign',
  'Create Campaign',
  'Modal stub for the lead-to-campaign action.',
);

export const LogCallPage = stub(
  'log_call',
  'Log a Call',
  'Modal stub for the global "log a call" action.',
);

export const MassUpdateStagePage = stub(
  'mass_update_stage',
  'Mass Update Stage',
  'Modal stub for the opportunity mass-update-stage action.',
);

export const SendEmailPage = stub(
  'send_email',
  'Send Email',
  'Modal stub for the contact send-email action.',
);
