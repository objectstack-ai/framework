// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Page } from '@objectstack/spec/ui';

/**
 * Account Detail Slotted Page
 *
 * Demonstrates the ObjectUI **slotted page** pattern: instead of
 * authoring the full record page, we declare `kind: "slotted"` and
 * provide overrides for only the slots we care about. The default-page
 * synthesizer fills in every other slot (highlights, tabs, history,
 * etc.) from the object definition.
 *
 * This page replaces only the `header` slot: a custom heading row with
 * an "Account" eyebrow + record name + industry badge — a richer
 * variant than the auto-synthesized `page:header`.
 *
 * Slot menu (v1): header | actions | highlights | details | tabs |
 * discussion.
 *
 * NOTE: `kind` and `slots` are an ObjectUI extension to `PageSchema`
 * not yet upstreamed into @objectstack/spec; the cast keeps the seed
 * type-checking while the spec change rolls out.
 */
export const AccountDetailPage = {
  name: 'account_detail_page',
  label: 'Account Detail',
  description:
    'Slotted detail page for Account — overrides only the header; ' +
    'all other regions (highlights, tabs, history) ride synthesized defaults.',

  type: 'record',
  object: 'account',

  kind: 'slotted',

  // Slotted pages don't author `regions` — the default-page synthesizer
  // owns the layout. We declare an empty array purely to satisfy the
  // current spec validator (which requires `regions` for every Page).
  // The future spec update for `kind: 'slotted'` will mark `regions`
  // optional when `kind === 'slotted'`.
  regions: [],

  slots: {
    header: {
      type: 'page:header',
      id: 'account_header_slotted',
      label: 'Account Header (slotted)',
      properties: {
        title: '{name}',
        subtitle: '{industry} · {type}',
        eyebrow: 'ACCOUNT',
        icon: 'building-2',
        breadcrumb: true,
      },
    },
  },
} as unknown as Page;
