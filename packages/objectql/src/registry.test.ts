import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry, applySystemFields, computeFQN, parseFQN, RESERVED_NAMESPACES } from './registry';

describe('SchemaRegistry', () => {
    let registry: SchemaRegistry;
    beforeEach(() => {
        // Use multiTenant: false in the bulk of the suite so the existing
        // assertions don't need to know about auto-injected system fields.
        // applySystemFields() has its own dedicated suite below.
        registry = new SchemaRegistry({ multiTenant: false });
    });

    // ==========================================
    // computeFQN / parseFQN — convention tests
    // ==========================================
    describe('computeFQN', () => {
        it('should return the short name unchanged (no namespace prefix)', () => {
            expect(computeFQN('crm', 'account')).toBe('account');
            expect(computeFQN('todo', 'task')).toBe('task');
        });

        it('should return the name for reserved namespaces', () => {
            expect(computeFQN('base', 'user')).toBe('user');
            expect(computeFQN('system', 'organization')).toBe('organization');
        });

        it('should return the name for undefined namespace', () => {
            expect(computeFQN(undefined, 'task')).toBe('task');
        });
    });

    describe('parseFQN', () => {
        it('should parse legacy FQN with double-underscore', () => {
            expect(parseFQN('crm__account')).toEqual({ namespace: 'crm', shortName: 'account' });
            expect(parseFQN('todo__task')).toEqual({ namespace: 'todo', shortName: 'task' });
        });

        it('should parse unprefixed names', () => {
            expect(parseFQN('user')).toEqual({ namespace: undefined, shortName: 'user' });
            expect(parseFQN('task')).toEqual({ namespace: undefined, shortName: 'task' });
        });
    });

    // ==========================================
    // Namespace Management Tests
    // ==========================================
    describe('Namespace Management', () => {
        it('should register namespace', () => {
            registry.registerNamespace('crm', 'com.example.crm');
            expect(registry.getNamespaceOwner('crm')).toBe('com.example.crm');
        });

        it('should allow same package to re-register namespace', () => {
            registry.registerNamespace('crm', 'com.example.crm');
            expect(() => {
                registry.registerNamespace('crm', 'com.example.crm');
            }).not.toThrow();
        });

        it('should allow multiple packages to share a namespace', () => {
            registry.registerNamespace('sys', 'com.objectstack.auth');
            registry.registerNamespace('sys', 'com.objectstack.security');
            // First registered package returned for backwards compat
            expect(registry.getNamespaceOwner('sys')).toBe('com.objectstack.auth');
            expect(registry.getNamespaceOwners('sys')).toEqual([
                'com.objectstack.auth',
                'com.objectstack.security',
            ]);
        });

        it('should unregister namespace', () => {
            registry.registerNamespace('crm', 'com.example.crm');
            registry.unregisterNamespace('crm', 'com.example.crm');
            expect(registry.getNamespaceOwner('crm')).toBeUndefined();
        });

        it('should keep namespace when one of multiple packages unregisters', () => {
            registry.registerNamespace('sys', 'com.objectstack.auth');
            registry.registerNamespace('sys', 'com.objectstack.setup');
            registry.unregisterNamespace('sys', 'com.objectstack.setup');
            expect(registry.getNamespaceOwner('sys')).toBe('com.objectstack.auth');
        });
    });

    // ==========================================
    // Object Ownership Tests
    // ==========================================
    describe('Object Ownership', () => {
        it('should register owned object using object name as canonical key', () => {
            const obj = { name: 'account', fields: { name: { type: 'text' } } };
            const key = registry.registerObject(obj as any, 'com.example.crm', 'crm', 'own');

            expect(key).toBe('account');
            const resolved = registry.getObject('account');
            expect(resolved).toBeDefined();
            expect(resolved?.name).toBe('account');
        });

        it('should register object without namespace', () => {
            const obj = { name: 'task', fields: {} };
            const key = registry.registerObject(obj as any, 'com.example.app');

            expect(key).toBe('task');
            expect(registry.getObject('task')).toBeDefined();
        });

        it('should allow only one owner per object name', () => {
            const obj = { name: 'shared', fields: {} };
            registry.registerObject(obj as any, 'com.vendor.a', 'vendor_a', 'own');

            const obj2 = { name: 'shared', fields: {} };
            expect(() => {
                registry.registerObject(obj2 as any, 'com.vendor.b', undefined, 'own');
            }).toThrow(/already owned/);
        });

        it('should allow re-registration by same owner', () => {
            const obj = { name: 'account', fields: { v1: { type: 'text' } } };
            registry.registerObject(obj as any, 'com.example.crm', 'crm', 'own');

            const obj2 = { name: 'account', fields: { v2: { type: 'text' } } };
            expect(() => {
                registry.registerObject(obj2 as any, 'com.example.crm', 'crm', 'own');
            }).not.toThrow();

            const resolved = registry.getObject('account');
            expect(resolved?.fields).toHaveProperty('v2');
        });
    });

    // ==========================================
    // Object Extension Tests
    // ==========================================
    describe('Object Extension', () => {
        it('should merge extension fields into owner', () => {
            const owner = { name: 'contact', fields: { email: { type: 'text' } } };
            registry.registerObject(owner as any, 'com.base', 'base', 'own');

            const ext = { name: 'contact', fields: { phone: { type: 'text' } } };
            registry.registerObject(ext as any, 'com.crm', undefined, 'extend', 200);

            const resolved = registry.getObject('contact');
            expect(resolved?.fields).toHaveProperty('email');
            expect(resolved?.fields).toHaveProperty('phone');
        });

        it('should apply priority order (higher wins)', () => {
            const owner = { name: 'task', label: 'Task', fields: {} };
            registry.registerObject(owner as any, 'com.base', 'base', 'own', 100);

            const ext1 = { name: 'task', label: 'Extended Task', fields: {} };
            registry.registerObject(ext1 as any, 'com.ext1', undefined, 'extend', 150);

            const ext2 = { name: 'task', label: 'Final Task', fields: {} };
            registry.registerObject(ext2 as any, 'com.ext2', undefined, 'extend', 250);

            const resolved = registry.getObject('task');
            expect(resolved?.label).toBe('Final Task');
        });

        it('should merge validations additively', () => {
            const owner = { name: 'order', fields: {}, validations: [{ type: 'required', field: 'id' }] };
            registry.registerObject(owner as any, 'com.base', 'base', 'own');

            const ext = { name: 'order', fields: {}, validations: [{ type: 'required', field: 'status' }] };
            registry.registerObject(ext as any, 'com.ext', undefined, 'extend');

            const resolved = registry.getObject('order');
            expect(resolved?.validations).toHaveLength(2);
        });

        it('should fail extension without owner', () => {
            const ext = { name: 'phantom', fields: {} };
            registry.registerObject(ext as any, 'com.ext', undefined, 'extend');

            const resolved = registry.getObject('phantom');
            expect(resolved).toBeUndefined();
        });
    });

    // ==========================================
    // Object Resolution Tests
    // ==========================================
    describe('Object Resolution', () => {
        it('should resolve by canonical name', () => {
            const obj = { name: 'deal', fields: {} };
            registry.registerObject(obj as any, 'com.crm', 'crm', 'own');

            expect(registry.resolveObject('deal')).toBeDefined();
        });

        it('should resolve system objects by their sys_ prefixed name', () => {
            const obj = { name: 'sys_user', fields: {} };
            registry.registerObject(obj as any, 'com.objectstack.system', 'sys', 'own');

            expect(registry.getObject('sys_user')).toBeDefined();
        });

        it('should cache merged objects', () => {
            const obj = { name: 'cached', fields: {} };
            registry.registerObject(obj as any, 'com.test', 'test', 'own');

            const first = registry.resolveObject('cached');
            const second = registry.resolveObject('cached');
            expect(first).toBe(second);
        });

        it('should invalidate cache on re-registration', () => {
            const obj = { name: 'evolve', fields: { v1: { type: 'text' } } };
            registry.registerObject(obj as any, 'com.test', 'test', 'own');

            const first = registry.resolveObject('evolve');

            const obj2 = { name: 'evolve', fields: { v2: { type: 'text' } } };
            registry.registerObject(obj2 as any, 'com.test', 'test', 'own');

            const second = registry.resolveObject('evolve');
            expect(first).not.toBe(second);
            expect(second?.fields).toHaveProperty('v2');
        });
    });

    // ==========================================
    // getAllObjects Tests
    // ==========================================
    describe('getAllObjects', () => {
        it('should return all merged objects', () => {
            registry.registerObject({ name: 'a', fields: {} } as any, 'com.pkg1', 'pkg1', 'own');
            registry.registerObject({ name: 'b', fields: {} } as any, 'com.pkg2', 'pkg2', 'own');

            const all = registry.getAllObjects();
            expect(all).toHaveLength(2);
            expect(all.map(o => o.name).sort()).toEqual(['a', 'b']);
        });

        it('should filter by packageId', () => {
            registry.registerObject({ name: 'a', fields: {} } as any, 'com.pkg1', 'pkg1', 'own');
            registry.registerObject({ name: 'b', fields: {} } as any, 'com.pkg2', 'pkg2', 'own');

            const filtered = registry.getAllObjects('com.pkg1');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe('a');
        });

        it('should include objects where package is extender', () => {
            registry.registerObject({ name: 'base_obj', fields: {} } as any, 'com.owner', 'base', 'own');
            registry.registerObject({ name: 'base_obj', fields: { ext: { type: 'text' } } } as any, 'com.extender', undefined, 'extend');

            const filtered = registry.getAllObjects('com.extender');
            expect(filtered).toHaveLength(1);
        });
    });

    // ==========================================
    // Uninstall Tests
    // ==========================================
    describe('Uninstall', () => {
        it('should remove owner contribution', () => {
            registry.registerObject({ name: 'removable', fields: {} } as any, 'com.pkg', 'pkg', 'own');
            expect(registry.getObject('removable')).toBeDefined();

            registry.unregisterObjectsByPackage('com.pkg');
            expect(registry.getObject('removable')).toBeUndefined();
        });

        it('should remove extension contribution', () => {
            registry.registerObject({ name: 'target', fields: { base: { type: 'text' } } } as any, 'com.owner', 'base', 'own');
            registry.registerObject({ name: 'target', fields: { ext: { type: 'text' } } } as any, 'com.ext', undefined, 'extend');

            registry.unregisterObjectsByPackage('com.ext');

            const resolved = registry.getObject('target');
            expect(resolved?.fields).toHaveProperty('base');
            expect(resolved?.fields).not.toHaveProperty('ext');
        });

        it('should prevent uninstall of owner with active extenders', () => {
            registry.registerObject({ name: 'important', fields: {} } as any, 'com.owner', 'base', 'own');
            registry.registerObject({ name: 'important', fields: {} } as any, 'com.ext', undefined, 'extend');

            expect(() => {
                registry.unregisterObjectsByPackage('com.owner');
            }).toThrow(/extended by/);
        });

        it('should allow force uninstall of owner with extenders', () => {
            registry.registerObject({ name: 'forced', fields: {} } as any, 'com.owner', 'base', 'own');
            registry.registerObject({ name: 'forced', fields: {} } as any, 'com.ext', undefined, 'extend');

            expect(() => {
                registry.unregisterObjectsByPackage('com.owner', true);
            }).not.toThrow();
        });
    });

    // ==========================================
    // Contributors API Tests
    // ==========================================
    describe('Contributors API', () => {
        it('should return all contributors for object', () => {
            registry.registerObject({ name: 'multi', fields: {} } as any, 'com.owner', 'pkg', 'own', 100);
            registry.registerObject({ name: 'multi', fields: {} } as any, 'com.ext1', undefined, 'extend', 200);
            registry.registerObject({ name: 'multi', fields: {} } as any, 'com.ext2', undefined, 'extend', 300);

            const contribs = registry.getObjectContributors('multi');
            expect(contribs).toHaveLength(3);
            expect(contribs[0].priority).toBe(100);
            expect(contribs[1].priority).toBe(200);
            expect(contribs[2].priority).toBe(300);
        });

        it('should return owner contributor', () => {
            registry.registerObject({ name: 'owned', fields: {} } as any, 'com.owner', 'pkg', 'own');

            const owner = registry.getObjectOwner('owned');
            expect(owner).toBeDefined();
            expect(owner?.packageId).toBe('com.owner');
            expect(owner?.ownership).toBe('own');
        });
    });

    // ==========================================
    // Generic Metadata Tests (Non-Object)
    // ==========================================
    describe('Generic Metadata', () => {
        it('should register and retrieve generic items', () => {
            const item = { name: 'test_action', type: 'custom' };
            registry.registerItem('action', item, 'name', 'com.pkg');

            const retrieved = registry.getItem('action', 'test_action');
            expect(retrieved).toEqual(item);
        });

        it('should list items by type with package filter', () => {
            registry.registerItem('action', { name: 'a1' }, 'name', 'com.pkg1');
            registry.registerItem('action', { name: 'a2' }, 'name', 'com.pkg2');

            const filtered = registry.listItems('action', 'com.pkg1');
            expect(filtered).toHaveLength(1);
        });
    });

    // ==========================================
    // Package Management Tests
    // ==========================================
    describe('Package Management', () => {
        it('should install package with namespace', () => {
            const manifest = { id: 'com.test', name: 'Test', namespace: 'test', version: '1.0.0' };
            const pkg = registry.installPackage(manifest as any);

            expect(pkg.status).toBe('installed');
            expect(registry.getNamespaceOwner('test')).toBe('com.test');
        });

        it('should uninstall package and release namespace', () => {
            const manifest = { id: 'com.test', name: 'Test', namespace: 'test', version: '1.0.0' };
            registry.installPackage(manifest as any);

            registry.uninstallPackage('com.test');
            expect(registry.getPackage('com.test')).toBeUndefined();
            expect(registry.getNamespaceOwner('test')).toBeUndefined();
        });
    });

    // ==========================================
    // Reset Tests
    // ==========================================
    describe('Reset', () => {
        it('should clear all state', () => {
            registry.registerObject({ name: 'obj', fields: {} } as any, 'com.pkg', 'pkg', 'own');
            registry.registerItem('action', { name: 'act' }, 'name');

            registry.reset();

            expect(registry.getAllObjects()).toHaveLength(0);
            expect(registry.listItems('action')).toHaveLength(0);
        });
    });

    // ==========================================
    // listItems/getItem for 'object' type Tests
    // ==========================================
    describe('listItems and getItem for object type', () => {
        it('listItems("object") should return all registered objects', () => {
            registry.registerObject(
                { name: 'account', label: 'Account', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            registry.registerObject(
                { name: 'contact', label: 'Contact', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );

            const objects = registry.listItems('object');
            expect(objects).toHaveLength(2);
            expect(objects.map((o: any) => o.name).sort()).toEqual(['account', 'contact']);
        });

        it('listItems("objects") should return all registered objects (plural alias)', () => {
            registry.registerObject(
                { name: 'task', label: 'Task', fields: {} } as any,
                'com.todo',
                'todo',
                'own'
            );

            const objects = registry.listItems('objects');
            expect(objects).toHaveLength(1);
            expect((objects[0] as any).name).toBe('task');
        });

        it('getItem("object", name) should return object by canonical name', () => {
            registry.registerObject(
                { name: 'lead', label: 'Lead', fields: { status: { type: 'text' } } } as any,
                'com.crm',
                'crm',
                'own'
            );

            const obj = registry.getItem('object', 'lead');
            expect(obj).toBeDefined();
            expect((obj as any).name).toBe('lead');
            expect((obj as any).label).toBe('Lead');
        });

        it('getItem("object", name) should return object by name', () => {
            registry.registerObject(
                { name: 'opportunity', label: 'Opportunity', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );

            const obj = registry.getItem('object', 'opportunity');
            expect(obj).toBeDefined();
            expect((obj as any).name).toBe('opportunity');
        });

        it('listItems("object", packageId) should filter by package', () => {
            registry.registerObject(
                { name: 'account', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            registry.registerObject(
                { name: 'task', fields: {} } as any,
                'com.todo',
                'todo',
                'own'
            );

            const crmObjects = registry.listItems('object', 'com.crm');
            expect(crmObjects).toHaveLength(1);
            expect((crmObjects[0] as any).name).toBe('account');

            const todoObjects = registry.listItems('object', 'com.todo');
            expect(todoObjects).toHaveLength(1);
            expect((todoObjects[0] as any).name).toBe('task');
        });
    });
});

// ==========================================
// applySystemFields — system field auto-injection
// ==========================================
describe('applySystemFields', () => {
    const baseLead: any = { name: 'lead', label: 'Lead', fields: { first_name: { type: 'text' } } };

    it('injects an indexed organization_id when multiTenant is true and field is missing', () => {
        const out = applySystemFields(baseLead, { multiTenant: true });
        expect(out.fields.organization_id).toBeDefined();
        expect(out.fields.organization_id.type).toBe('lookup');
        expect(out.fields.organization_id.reference).toBe('sys_organization');
        // Multi-tenant stacks index the column (per-tenant filtering).
        expect(out.fields.organization_id.indexed).toBe(true);
        // author-declared field still present
        expect(out.fields.first_name).toBeDefined();
    });

    it('still injects organization_id when multiTenant is false, but unindexed', () => {
        // The COLUMN is always provisioned (decoupled from the tenant flag) so
        // sudo writers can always stamp it; only the index is gated, since a
        // single-tenant DB never filters by organization.
        const out = applySystemFields(baseLead, { multiTenant: false });
        expect(out.fields.organization_id).toBeDefined();
        expect(out.fields.organization_id.type).toBe('lookup');
        expect(out.fields.organization_id.indexed).toBe(false);
        // audit fields are tenant-independent — still injected
        expect(out.fields.created_at).toBeDefined();
        expect(out.fields.updated_at).toBeDefined();
    });

    it('does NOT overwrite an author-declared organization_id', () => {
        const declared: any = {
            name: 'lead',
            fields: { organization_id: { type: 'text', label: 'Org Code' } },
        };
        const out = applySystemFields(declared, { multiTenant: true });
        // organization_id preserved; audit fields still injected
        expect(out.fields.organization_id.label).toBe('Org Code');
        expect(out.fields.created_at).toBeDefined();
    });

    it('respects systemFields: false opt-out', () => {
        const opted: any = { ...baseLead, systemFields: false };
        const out = applySystemFields(opted, { multiTenant: true });
        expect(out).toBe(opted);
        expect(out.fields.organization_id).toBeUndefined();
        expect(out.fields.created_at).toBeUndefined();
    });

    it('respects systemFields.tenant: false opt-out (audit fields still injected)', () => {
        const opted: any = { ...baseLead, systemFields: { tenant: false } };
        const out = applySystemFields(opted, { multiTenant: true });
        expect(out.fields.organization_id).toBeUndefined();
        expect(out.fields.created_at).toBeDefined();
        expect(out.fields.updated_by).toBeDefined();
    });

    it('respects systemFields.audit: false opt-out (tenant field still injected)', () => {
        const opted: any = { ...baseLead, systemFields: { audit: false } };
        const out = applySystemFields(opted, { multiTenant: true });
        expect(out.fields.organization_id).toBeDefined();
        expect(out.fields.created_at).toBeUndefined();
        expect(out.fields.created_by).toBeUndefined();
        expect(out.fields.updated_at).toBeUndefined();
        expect(out.fields.updated_by).toBeUndefined();
    });

    it('skips externally-managed objects (managedBy set)', () => {
        const sysUser: any = { name: 'sys_user', managedBy: 'better-auth', fields: { email: { type: 'text' } } };
        const out = applySystemFields(sysUser, { multiTenant: true });
        expect(out).toBe(sysUser);
        expect(out.fields.organization_id).toBeUndefined();
        expect(out.fields.created_at).toBeUndefined();
    });

    it('injects all four audit fields with the expected shape', () => {
        const out = applySystemFields(baseLead, { multiTenant: false });
        expect(out.fields.created_at).toMatchObject({
            type: 'datetime', system: true, readonly: true,
        });
        expect(out.fields.created_by).toMatchObject({
            type: 'lookup', reference: 'sys_user', system: true, readonly: true,
        });
        expect(out.fields.updated_at).toMatchObject({
            type: 'datetime', system: true, readonly: true,
        });
        expect(out.fields.updated_by).toMatchObject({
            type: 'lookup', reference: 'sys_user', system: true, readonly: true,
        });
    });

    it('does NOT overwrite author-declared audit fields', () => {
        const declared: any = {
            name: 'lead',
            fields: {
                created_at: { type: 'text', label: 'Custom Created' },
                updated_by: { type: 'text', label: 'Custom Updater' },
            },
        };
        const out = applySystemFields(declared, { multiTenant: false });
        expect(out.fields.created_at.type).toBe('text');
        expect(out.fields.created_at.label).toBe('Custom Created');
        expect(out.fields.updated_by.type).toBe('text');
        // The missing ones are still injected as system fields
        expect(out.fields.created_by).toMatchObject({ system: true });
        expect(out.fields.updated_at).toMatchObject({ system: true });
    });

    it('SchemaRegistry({ multiTenant: true }) auto-injects on registerObject', () => {
        const reg = new SchemaRegistry({ multiTenant: true });
        reg.registerObject({ name: 'lead', fields: { first_name: { type: 'text' } } } as any, 'crm', 'crm', 'own');
        const stored = (reg as any).objectContributors.get('lead')[0].definition;
        expect(stored.fields.organization_id).toBeDefined();
        expect(stored.fields.organization_id.reference).toBe('sys_organization');
        expect(stored.fields.created_at).toMatchObject({ system: true, readonly: true });
        expect(stored.fields.updated_by).toMatchObject({ system: true, readonly: true });
    });
});
