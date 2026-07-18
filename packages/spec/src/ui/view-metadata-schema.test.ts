// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * #3095 — `ViewMetadataSchema` is the canonical schema the `view` metadata type
 * registers (save-time 422 validation + read-time diagnostics). It MUST validate
 * all three runtime `view` shapes GENUINELY, where the bare container
 * {@link ViewSchema} was a no-op (Zod strip-parsed ViewItem/personalization
 * bodies to `{}`, so a broken `config` sailed through "valid").
 *
 *   1. defineView aggregate container  (non-empty)
 *   2. standalone ViewItem record       ({ name, object, viewKind, config })
 *   3. flattened personalization overlay (raw config + inherited identity, #2555)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ViewMetadataSchema } from './view.zod';

const PLACEHOLDER_DATA = { provider: 'object', object: 'crm_lead' } as const;

describe('ViewMetadataSchema — genuine validation across the three runtime shapes (#3095)', () => {
  // ── shape 2: standalone ViewItem record ───────────────────────────────────
  describe('ViewItem record form', () => {
    it('accepts a well-formed list ViewItem', () => {
      const r = ViewMetadataSchema.safeParse({
        name: 'crm_lead.all',
        object: 'crm_lead',
        viewKind: 'list',
        label: 'All Leads',
        config: { type: 'grid', columns: ['name'], data: PLACEHOLDER_DATA },
      });
      expect(r.success).toBe(true);
    });

    it('REJECTS a ViewItem whose kanban config is missing groupByField (was a no-op under ViewSchema)', () => {
      const r = ViewMetadataSchema.safeParse({
        name: 'crm_lead.pipeline',
        object: 'crm_lead',
        viewKind: 'list',
        config: {
          type: 'kanban',
          columns: ['name'],
          // groupByField is required by KanbanConfigSchema — omit it.
          kanban: { summarizeField: 'amount', columns: ['name'] },
        },
      });
      expect(r.success).toBe(false);
    });

    it('accepts a well-formed form ViewItem', () => {
      const r = ViewMetadataSchema.safeParse({
        name: 'crm_lead.edit',
        object: 'crm_lead',
        viewKind: 'form',
        config: { type: 'simple', sections: [{ label: 'Details', fields: ['name'] }] },
      });
      expect(r.success).toBe(true);
    });

    it('REJECTS a form ViewItem carrying an invalid form `type` (config validated, not stripped)', () => {
      const r = ViewMetadataSchema.safeParse({
        name: 'crm_lead.edit',
        object: 'crm_lead',
        viewKind: 'form',
        config: { type: 'not_a_real_form_type' },
      });
      expect(r.success).toBe(false);
    });
  });

  // ── shape 1: defineView container ─────────────────────────────────────────
  describe('defineView container form', () => {
    it('accepts a non-empty container', () => {
      const r = ViewMetadataSchema.safeParse({
        list: { type: 'grid', data: PLACEHOLDER_DATA, columns: [{ field: 'name' }] },
      });
      expect(r.success).toBe(true);
    });

    it('REJECTS a container whose nested list is missing required columns', () => {
      const r = ViewMetadataSchema.safeParse({
        list: { type: 'grid', data: PLACEHOLDER_DATA },
      });
      expect(r.success).toBe(false);
    });

    it('REJECTS an explicitly-empty container (zero views — mirrors defineView)', () => {
      // A body that names container slots but fills none of them registers no
      // view; the container member's non-empty refine rejects it, and the
      // flattened members reject it via their container-key guards.
      expect(ViewMetadataSchema.safeParse({ listViews: {}, formViews: {} }).success).toBe(false);
      expect(ViewMetadataSchema.safeParse({ listViews: {} }).success).toBe(false);
    });

    it('accepts a bare `{}` (legacy-compatible — the old ViewSchema also accepted it)', () => {
      // Not a regression: a truly empty body carries no viewKind/object, so
      // every consumer that filters on identity drops it. Pinned so the lenient
      // flattened-overlay branch behaviour is intentional, not accidental.
      expect(ViewMetadataSchema.safeParse({}).success).toBe(true);
    });
  });

  // ── shape 3: flattened personalization overlay (#2555) ────────────────────
  describe('flattened personalization overlay form', () => {
    it('accepts a raw list config with identity inherited from the shadowed entry', () => {
      // The exact shape normalizeViewMetadata persists on a console column-sort PUT.
      const r = ViewMetadataSchema.safeParse({
        type: 'grid',
        data: { provider: 'object', object: 'showcase_task' },
        columns: ['title'],
        sort: [{ id: '29200fa8-c416-471e-9ca3-913f9308ad89', field: 'estimate_hours', order: 'desc' }],
        name: 'showcase_task.default',
        viewKind: 'list',
        object: 'showcase_task',
        label: 'All Tasks',
      });
      expect(r.success).toBe(true);
    });

    it('accepts a raw list config with NO identity (adhoc PUT, no registry entry to inherit from)', () => {
      const r = ViewMetadataSchema.safeParse({
        type: 'grid',
        data: { provider: 'object', object: 'showcase_task' },
        columns: ['title'],
        sort: [{ field: 'estimate_hours', order: 'desc' }],
        name: 'adhoc.view',
      });
      expect(r.success).toBe(true);
    });

    it('accepts a raw form config overlay', () => {
      const r = ViewMetadataSchema.safeParse({
        type: 'simple',
        sections: [{ label: 'Details', fields: ['name'] }],
        name: 'crm_lead.edit',
        viewKind: 'form',
        object: 'crm_lead',
      });
      expect(r.success).toBe(true);
    });

    it('REJECTS a flattened list overlay whose kanban binding is broken (genuine, not stripped)', () => {
      const r = ViewMetadataSchema.safeParse({
        type: 'kanban',
        columns: ['name'],
        kanban: { summarizeField: 'amount', columns: ['name'] }, // no groupByField
        name: 'crm_lead.pipeline',
        viewKind: 'list',
        object: 'crm_lead',
      });
      expect(r.success).toBe(false);
    });

    it('preserves auxiliary Studio round-trip keys without a strict-mode 422', () => {
      // isPinned/sortOrder ride along on the overlay; the schema validates but
      // must not reject unknown top-level aux keys (saveMetaItem persists verbatim).
      const r = ViewMetadataSchema.safeParse({
        type: 'grid',
        data: PLACEHOLDER_DATA,
        columns: ['name'],
        name: 'crm_lead.all',
        viewKind: 'list',
        object: 'crm_lead',
        isPinned: true,
        sortOrder: 3,
      });
      expect(r.success).toBe(true);
    });
  });

  // ── mutual exclusion: a broken record/container is never rescued ──────────
  describe('member exclusivity', () => {
    it('does not rescue a broken record via the flattened branch (config guard)', () => {
      // A record body carries a nested `config`; the flattened members pin
      // `config` to undefined, so a broken config cannot be silently stripped.
      const r = ViewMetadataSchema.safeParse({
        name: 'crm_lead.pipeline',
        object: 'crm_lead',
        viewKind: 'list',
        config: { type: 'grid', columns: 'not-an-array' },
      });
      expect(r.success).toBe(false);
    });

    it('does not rescue a broken container via the flattened branch (list guard)', () => {
      const r = ViewMetadataSchema.safeParse({
        list: { type: 'grid', data: PLACEHOLDER_DATA }, // missing columns
        name: 'crm_lead.default',
      });
      expect(r.success).toBe(false);
    });
  });

  // ── JSON Schema emission (/api/v1/meta/types/view) ────────────────────────
  it('converts to a JSON Schema anyOf (union → anyOf) without throwing', () => {
    const json = z.toJSONSchema(ViewMetadataSchema, { unrepresentable: 'any' }) as Record<string, unknown>;
    expect(Array.isArray(json.anyOf)).toBe(true);
    expect((json.anyOf as unknown[]).length).toBe(4);
  });
});
