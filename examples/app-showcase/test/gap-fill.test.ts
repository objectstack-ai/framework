// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { SchemaRegistry } from '@objectstack/objectql';

import stack from '../objectstack.config.js';
import { DeliveryCube } from '../src/data/analytics/showcase.cube.js';
import { AccountExtension } from '../src/data/extensions/account.extension.js';
import { Account } from '../src/data/objects/account.object.js';

/**
 * Proof for the two STACK_COLLECTION_COVERAGE entries marked `demonstrated`
 * (see src/coverage.ts): the cube and the object extension are not just
 * declared — they are wired into the stack, and the extension merge is
 * exercised against the REAL SchemaRegistry (the same merge `registerApp`
 * step 2b performs at boot).
 */
describe('showcase gap fill — analytics cube', () => {
  it('is wired into the stack definition', () => {
    const cubes = (stack as { analyticsCubes?: Array<{ name: string }> }).analyticsCubes ?? [];
    expect(cubes.map((c) => c.name)).toContain('showcase_delivery');
  });

  it('declares measures and dimensions over the delivery backbone', () => {
    expect(DeliveryCube.sql).toBe('showcase_task');
    expect(Object.keys(DeliveryCube.measures ?? {})).toEqual(
      expect.arrayContaining(['count', 'total_estimate_hours', 'avg_estimate_hours', 'done_rate']),
    );
    expect(Object.keys(DeliveryCube.dimensions ?? {})).toEqual(
      expect.arrayContaining(['status', 'priority', 'due_date']),
    );
    expect(DeliveryCube.joins?.showcase_project?.relationship).toBe('many_to_one');
  });
});

describe('showcase gap fill — object extension (overlay merge)', () => {
  it('is wired into the stack definition', () => {
    const exts = (stack as { objectExtensions?: Array<{ extend: string }> }).objectExtensions ?? [];
    expect(exts.map((e) => e.extend)).toContain('showcase_account');
  });

  it('merges its fields into showcase_account via the real SchemaRegistry', () => {
    const registry = new SchemaRegistry();
    registry.registerObject(Account as never, 'com.example.showcase', undefined, 'own');
    registry.registerObject(
      {
        name: AccountExtension.extend,
        label: AccountExtension.label,
        fields: AccountExtension.fields,
      } as never,
      'com.example.showcase.overlay',
      undefined,
      'extend',
      AccountExtension.priority,
    );

    const merged = registry.getObject('showcase_account') as {
      fields?: Record<string, { type?: string }>;
    };
    expect(merged).toBeDefined();
    // Extension fields landed…
    expect(merged.fields?.loyalty_tier?.type).toBe('select');
    expect(merged.fields?.linkedin_url?.type).toBe('url');
    expect(merged.fields?.csat_score?.type).toBe('number');
    // …without clobbering the owner's fields.
    expect(merged.fields?.annual_revenue).toBeDefined();
  });
});
