// Copyright (c) 2026 ObjectStack contributors. Apache-2.0 license.
//
// `os doctor` reference analysis (15.1 third-party eval): the collector only
// read the legacy flat `view.object` / `nav.object` shapes, so an object
// bound through a defineView container (`list.data.object`, `listViews[*]`)
// and hung on app navigation (`objectName`) was still reported as
// "defined but not referenced". These fixtures pin the canonical shapes.

import { describe, it, expect } from 'vitest';
import { findUnusedObjects, findOrphanViews } from '../src/commands/doctor';

const obj = (name: string, fields: Record<string, unknown> = { title: { type: 'text', label: 'T' } }) => ({
  name,
  label: name,
  fields,
});

describe('findUnusedObjects', () => {
  it('sees objects bound through defineView containers (list / listViews / form)', () => {
    const config = {
      objects: [obj('crm_account'), obj('crm_contact'), obj('crm_lead')],
      views: [
        { list: { type: 'grid', data: { provider: 'object', object: 'crm_account' } } },
        {
          listViews: {
            recent: { type: 'grid', data: { provider: 'object', object: 'crm_contact' } },
          },
        },
        { form: { data: { provider: 'object', object: 'crm_lead' } } },
      ],
    };
    expect(findUnusedObjects(config)).toEqual([]);
  });

  it('sees app navigation objectName, nested children, and areas', () => {
    const config = {
      objects: [obj('crm_account'), obj('crm_contact'), obj('crm_case')],
      apps: [
        {
          name: 'crm',
          navigation: [
            { type: 'object', objectName: 'crm_account' },
            {
              type: 'group',
              label: 'More',
              children: [{ type: 'object', objectName: 'crm_contact' }],
            },
          ],
          areas: [
            { name: 'service', navigation: [{ type: 'object', objectName: 'crm_case' }] },
          ],
        },
      ],
    };
    expect(findUnusedObjects(config)).toEqual([]);
  });

  it('sees the object inside flow node config (record_change trigger / CRUD nodes)', () => {
    const config = {
      objects: [obj('crm_order')],
      flows: [
        {
          name: 'on_order_change',
          nodes: [{ id: 't1', type: 'record_change', config: { object: 'crm_order' } }],
        },
      ],
    };
    expect(findUnusedObjects(config)).toEqual([]);
  });

  it('sees subform childObject and lookup form-field references', () => {
    const config = {
      objects: [obj('crm_order'), obj('crm_order_line'), obj('crm_account')],
      views: [
        {
          list: { type: 'grid', data: { provider: 'object', object: 'crm_order' } },
          form: {
            data: { provider: 'object', object: 'crm_order' },
            subforms: [{ field: 'lines', childObject: 'crm_order_line' }],
            sections: [
              { fields: [{ name: 'account', type: 'lookup', reference: 'crm_account' }] },
            ],
          },
        },
      ],
    };
    expect(findUnusedObjects(config)).toEqual([]);
  });

  it('still reads legacy flat ViewItems and lookup fields', () => {
    const config = {
      objects: [
        obj('crm_account'),
        obj('crm_contact', {
          account: { type: 'lookup', reference: 'crm_account', label: 'Account' },
        }),
      ],
      views: [{ name: 'contacts', object: 'crm_contact' }],
    };
    expect(findUnusedObjects(config)).toEqual([]);
  });

  it('still reports a genuinely unreferenced object', () => {
    const config = {
      objects: [obj('crm_account'), obj('crm_orphan')],
      views: [{ list: { type: 'grid', data: { provider: 'object', object: 'crm_account' } } }],
    };
    const unused = findUnusedObjects(config);
    expect(unused).toHaveLength(1);
    expect(unused[0]).toContain('"crm_orphan"');
  });
});

describe('findOrphanViews', () => {
  it('reports container sub-views bound to non-existent objects', () => {
    const config = {
      objects: [obj('crm_account')],
      views: [
        { list: { type: 'grid', data: { provider: 'object', object: 'crm_account' } } },
        {
          listViews: {
            ghosts: { type: 'grid', data: { provider: 'object', object: 'crm_ghost' } },
          },
        },
      ],
    };
    const orphans = findOrphanViews(config);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toContain('"crm_ghost"');
    expect(orphans[0]).toContain('listViews.ghosts');
  });

  it('passes healthy containers and non-object providers', () => {
    const config = {
      objects: [obj('crm_account')],
      views: [
        {
          list: { type: 'grid', data: { provider: 'object', object: 'crm_account' } },
          form: { data: { provider: 'schema', schemaId: 'report' } },
        },
      ],
    };
    expect(findOrphanViews(config)).toEqual([]);
  });
});
