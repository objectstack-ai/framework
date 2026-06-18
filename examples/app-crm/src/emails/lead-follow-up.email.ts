// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { EmailTemplateDefinitionInput } from '@objectstack/spec/system';

/**
 * Follow-up nudge sent by the Stale Opportunity workflow when no
 * activity has been logged on a Lead for the configured threshold.
 */
export const LeadFollowUpEmail: EmailTemplateDefinitionInput = {
  name: 'crm.lead_followup',
  label: 'Lead — Follow-Up Reminder',
  category: 'notification',
  locale: 'en-US',
  subject: 'Reminder: follow up on {{lead.name}}',
  bodyHtml: `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1f2937;margin:0;padding:24px;background:#f9fafb">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;border:1px solid #e5e7eb">
    <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600">Time to follow up</h1>
    <p>Hi {{owner.name}},</p>
    <p>Lead <strong>{{lead.name}}</strong> ({{lead.company}}) has had no activity for <strong>{{days_idle}} days</strong>.</p>
    <p>Open the lead in CRM and log the next action to keep your pipeline healthy.</p>
    <p style="margin:24px 0"><a href="{{{lead_url}}}" style="display:inline-block;padding:10px 20px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">View lead</a></p>
  </div>
</body></html>`,
  bodyText: `Hi {{owner.name}},

Lead {{lead.name}} ({{lead.company}}) has had no activity for {{days_idle}} days.

Follow up: {{lead_url}}`,
  variables: [
    { name: 'owner.name', type: 'string', required: true },
    { name: 'lead.name', type: 'string', required: true },
    { name: 'lead.company', type: 'string', required: false },
    { name: 'days_idle', type: 'number', required: true },
    { name: 'lead_url', type: 'url', required: true },
  ],
  active: true,
  description: 'Internal reminder fired by the Stale Opportunity workflow.',
};
