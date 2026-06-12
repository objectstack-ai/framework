// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { DocSchema } from './doc.zod';
import { ObjectStackDefinitionSchema } from '../stack.zod';
import { MetadataTypeSchema } from '../kernel/metadata-plugin.zod';
import { getMetadataTypeSchema } from '../kernel/metadata-type-schemas';
import { pluralToSingular } from '../shared/metadata-collection.zod';

describe('DocSchema (ADR-0046)', () => {
  it('accepts a minimal doc (name + content)', () => {
    const doc = DocSchema.parse({
      name: 'crm_lead_guide',
      content: '# Lead Guide\n\nHow to work leads.',
    });
    expect(doc.name).toBe('crm_lead_guide');
    expect(doc.label).toBeUndefined();
  });

  it('accepts an optional label', () => {
    const doc = DocSchema.parse({
      name: 'crm_index',
      label: 'CRM Overview',
      content: 'What this package is.',
    });
    expect(doc.label).toBe('CRM Overview');
  });

  it('rejects non-snake_case names', () => {
    for (const name of ['CrmGuide', 'crm-guide', '1crm', 'crm guide', '']) {
      expect(() => DocSchema.parse({ name, content: 'x' }), name).toThrow();
    }
  });

  it('rejects a doc without content', () => {
    expect(() => DocSchema.parse({ name: 'crm_index' })).toThrow();
  });
});

describe('stack `docs` element wiring', () => {
  it('parses a stack carrying docs', () => {
    const stack = ObjectStackDefinitionSchema.parse({
      manifest: { id: 'com.example.crm', name: 'CRM', version: '1.0.0', type: 'app', namespace: 'crm' },
      docs: [
        { name: 'crm_index', content: '# CRM' },
        { name: 'crm_lead_guide', label: 'Leads', content: 'See [overview](./crm_index.md).' },
      ],
    });
    expect(stack.docs).toHaveLength(2);
  });

  it('registers `doc` as a metadata type with a canonical schema', () => {
    expect(MetadataTypeSchema.parse('doc')).toBe('doc');
    expect(getMetadataTypeSchema('doc')).toBeDefined();
  });

  it('maps the plural stack key to the singular registry type', () => {
    expect(pluralToSingular('docs')).toBe('doc');
  });
});
