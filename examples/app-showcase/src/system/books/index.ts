// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineBook } from '@objectstack/spec';

/**
 * Showcase documentation book (ADR-0046 §6). A spine only: groups are ordered
 * and curated, but membership is DERIVED — `guides` picks up any
 * `showcase_*_guide` doc by rule, so a new guide files itself with no edit to
 * this book. `audience: 'public'` exposes it anonymously via the library
 * portal so the resolved tree can be verified without a session.
 */
export const ShowcaseBook = defineBook({
  name: 'showcase_manual',
  label: 'Showcase Manual',
  description: 'Everything in the kitchen-sink workspace.',
  slug: 'manual',
  order: 0,
  audience: 'public',
  groups: [
    {
      key: 'start',
      label: 'Getting Started',
      order: 1,
      // Explicit override: pin the index first, then sweep any other intro docs.
      pages: ['showcase_index', '...'],
    },
    {
      key: 'tour',
      label: 'Guided Tour',
      order: 2,
      // Explicit list: fixes the domain order (include-globs sort by name).
      pages: [
        'showcase_tour_data',
        'showcase_tour_ui',
        'showcase_tour_automation',
        'showcase_tour_system',
        'showcase_tour_security',
      ],
    },
    {
      key: 'guides',
      label: 'Guides',
      order: 3,
      include: 'showcase_*_guide', // derived: every guide doc, present and future
    },
  ],
});

export const allBooks = [ShowcaseBook];
