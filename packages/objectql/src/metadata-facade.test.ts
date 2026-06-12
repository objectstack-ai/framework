// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry } from './registry';
import { MetadataFacade } from './metadata-facade';

describe('MetadataFacade provenance passthrough', () => {
    let registry: SchemaRegistry;
    let facade: MetadataFacade;

    beforeEach(() => {
        registry = new SchemaRegistry({ multiTenant: false });
        facade = new MetadataFacade(registry);
    });

    it('passes the item\'s own _packageId through to registerItem so _provenance is stamped', async () => {
        await facade.register('page', 'installed_apps', {
            name: 'installed_apps',
            _packageId: 'com.example.marketplace',
        });

        const item = registry.getItem<any>('page', 'installed_apps');
        expect(item).toBeDefined();
        expect(item._packageId).toBe('com.example.marketplace');
        expect(item._provenance).toBe('package');

        // listItems is what protocol.getMetaItems serves from — the stamp
        // must survive enumeration too.
        const listed = registry.listItems<any>('page');
        expect(listed).toHaveLength(1);
        expect(listed[0]._packageId).toBe('com.example.marketplace');
        expect(listed[0]._provenance).toBe('package');
    });

    it('leaves runtime-authored items (no _packageId) unstamped', async () => {
        await facade.register('page', 'my_user_page', { name: 'my_user_page' });

        const item = registry.getItem<any>('page', 'my_user_page');
        expect(item).toBeDefined();
        expect(item._packageId).toBeUndefined();
        expect(item._provenance).toBeUndefined();
    });

    it('never invents a synthetic package id for object registrations', async () => {
        await facade.register('object', 'task', {
            name: 'task',
            label: 'Task',
            fields: {},
        });

        // getItem('object', …) routes to the merged-object path, so read the
        // generic collection directly to inspect what register() stored.
        const stored = (registry as any).metadata.get('object')?.get('task');
        expect(stored).toBeDefined();
        expect(stored._packageId).toBeUndefined();
        expect(stored._provenance).toBeUndefined();
    });
});
