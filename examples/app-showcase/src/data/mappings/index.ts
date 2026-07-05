// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineMapping } from '@objectstack/spec';

/**
 * Named import mapping (#2611) — the reusable, governed counterpart of the
 * import wizard's one-off inline rename. This one models the classic
 * enterprise case: a marketing tool exports leads weekly with ITS column
 * names and ITS channel codes; the mapping is defined once, ships with the
 * package, and every import (human or scheduled job) references it by name:
 *
 *   POST /api/v1/data/showcase_inquiry/import
 *   { "format": "csv", "csv": "...", "mappingName": "showcase_inquiry_feed" }
 *
 * mode/upsertKey make re-importing the same file idempotent (dedupe on
 * email) — no writeMode/matchFields needed on the request. The `map`
 * transform translates the source system's channel codes; the import
 * pipeline's own coercion + reference resolution still run afterwards.
 */
export const InquiryFeedMapping = defineMapping({
  name: 'showcase_inquiry_feed',
  label: 'Inquiry feed (marketing CSV)',
  sourceFormat: 'csv',
  targetObject: 'showcase_inquiry',
  fieldMapping: [
    { source: 'Full Name', target: 'name' },
    { source: 'E-mail', target: 'email' },
    { source: 'Company', target: 'company' },
    { source: 'Message', target: 'message' },
    {
      source: 'Channel',
      target: 'source',
      transform: 'map',
      params: { valueMap: { Webform: 'website', 'Partner Referral': 'referral' } },
    },
  ],
  mode: 'upsert',
  upsertKey: ['email'],
});

export const allMappings = [InquiryFeedMapping];
