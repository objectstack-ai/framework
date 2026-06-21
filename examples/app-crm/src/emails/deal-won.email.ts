// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineEmailTemplateDefinition } from '@objectstack/spec/system';

/**
 * Sent when an opportunity moves to Closed Won.
 * Referenced by the `notify_owner_deal_won` workflow action.
 */
export const DealWonEmail = defineEmailTemplateDefinition({
  name: 'crm.deal_won',
  label: 'Deal Won — Owner Congrats',
  category: 'workflow',
  locale: 'en-US',
  subject: 'Congratulations — {{opportunity.name}} closed!',
  bodyHtml: `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1f2937;margin:0;padding:24px;background:#f9fafb">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;border:1px solid #e5e7eb">
    <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600">Great news!</h1>
    <p>Hi {{user.name}},</p>
    <p>The opportunity <strong>{{opportunity.name}}</strong> for {{account.name}} just closed at <strong>\${{opportunity.amount}}</strong>.</p>
    <p>Nice work! 🎉</p>
  </div>
</body></html>`,
  bodyText: `Hi {{user.name}},

The opportunity {{opportunity.name}} for {{account.name}} just closed at \${{opportunity.amount}}.

Nice work!`,
  variables: [
    { name: 'user.name', type: 'string', required: true, description: 'Opportunity owner' },
    { name: 'opportunity.name', type: 'string', required: true },
    { name: 'opportunity.amount', type: 'number', required: true, description: 'Closed amount in USD' },
    { name: 'account.name', type: 'string', required: true },
  ],
  active: true,
  description: 'Internal congrats email fired by the High-Value Deal workflow when stage = Closed Won.',
});
