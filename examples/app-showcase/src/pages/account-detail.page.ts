// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * Account 360 — the flagship "object 360" record page every enterprise app has,
 * and the first showcase page to exercise the related-data + collaboration
 * blocks that nothing else used before:
 *   • `record:related_list` — the account's Projects and Invoices, each a live
 *                             child list (relationshipField = the `account`
 *                             lookup on the child object).
 *   • `record:history` — a self-fetching audit tab (sys_activity field_change),
 *     and the same changes also surface in the discussion feed.
 *   • the synthesized `discussion` slot — a unified activity + comment feed
 *     (@mentions, reactions): the human collaboration surface, for free.
 *   • `record:highlights` + `record:details` — the summary strip + sections.
 *
 * `kind: 'slotted'` — overrides only `highlights` + `tabs`; the synthesizer
 * fills the header and the discussion feed. (Tabs-with-children render under the
 * slotted path; the same shape inside a full-page region does not — mirror the
 * working Project Detail page.)
 */
export const AccountDetailPage: Page = {
  name: 'showcase_account_detail',
  label: 'Account',
  type: 'record',
  object: 'showcase_account',
  kind: 'slotted',
  template: 'default',
  isDefault: true,
  regions: [],
  slots: {
    highlights: {
      type: 'record:highlights',
      properties: { fields: ['status', 'industry', 'annual_revenue'] },
    },
    tabs: {
      type: 'page:tabs',
      properties: {
        type: 'line',
        items: [
          {
            key: 'details',
            label: 'Details',
            children: [
              {
                type: 'record:details',
                properties: {
                  sections: [
                    { label: 'Company', columns: 2, fields: ['website', 'hq'] },
                    { label: 'Billing', columns: 2, fields: ['tax_id', 'billing_email'] },
                  ],
                },
              },
            ],
          },
          {
            key: 'projects',
            label: 'Projects',
            children: [
              {
                type: 'record:related_list',
                properties: {
                  objectName: 'showcase_project',
                  relationshipField: 'account',
                  title: 'Projects',
                  columns: ['name', 'status', 'health', 'budget', 'end_date'],
                  sort: [{ field: 'budget', order: 'desc' }],
                  limit: 10,
                  showViewAll: true,
                },
              },
            ],
          },
          {
            key: 'invoices',
            label: 'Invoices',
            children: [
              {
                type: 'record:related_list',
                properties: {
                  objectName: 'showcase_invoice',
                  relationshipField: 'account',
                  title: 'Invoices',
                  columns: ['name', 'status', 'total', 'issued_on'],
                  sort: [{ field: 'issued_on', order: 'desc' }],
                  limit: 10,
                  showViewAll: true,
                },
              },
            ],
          },
          {
            key: 'history',
            label: 'History',
            children: [
              // Self-fetches from sys_activity (field_change events) via record
              // context — trackHistory on status/industry feeds the entries.
              { type: 'record:history', properties: { limit: 50 } },
            ],
          },
        ],
      },
    },
  },
};
