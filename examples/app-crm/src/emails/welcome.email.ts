// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { EmailTemplateDefinitionInput } from '@objectstack/spec/system';

/**
 * Welcome email sent to a Contact after it's added to the CRM.
 * Demonstrates marketing-category templates with a clear CTA.
 */
export const WelcomeEmail: EmailTemplateDefinitionInput = {
  name: 'crm.welcome',
  label: 'Welcome — New Contact',
  category: 'marketing',
  locale: 'en-US',
  subject: 'Welcome to {{account.name}}, {{contact.first_name}}!',
  bodyHtml: `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1f2937;margin:0;padding:24px;background:#f9fafb">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;border:1px solid #e5e7eb">
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:600">Welcome aboard 👋</h1>
    <p>Hi {{contact.first_name}},</p>
    <p>Thanks for connecting with <strong>{{account.name}}</strong>. Your account manager <strong>{{owner.name}}</strong> will be in touch shortly.</p>
    <p style="margin:24px 0"><a href="{{{portal_url}}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Open your customer portal</a></p>
    <p style="font-size:13px;color:#6b7280">Or copy this link: <span style="word-break:break-all">{{portal_url}}</span></p>
  </div>
</body></html>`,
  bodyText: `Hi {{contact.first_name}},

Thanks for connecting with {{account.name}}. Your account manager {{owner.name}} will be in touch shortly.

Open your portal: {{portal_url}}`,
  variables: [
    { name: 'contact.first_name', type: 'string', required: true },
    { name: 'account.name', type: 'string', required: true },
    { name: 'owner.name', type: 'string', required: true, description: 'Assigned account manager' },
    { name: 'portal_url', type: 'url', required: true, description: 'Customer portal link' },
  ],
  fromOverride: { name: 'Acme Sales', address: 'sales@acme.example' },
  replyTo: 'support@acme.example',
  active: true,
  description: 'Marketing welcome email sent on contact creation.',
};
