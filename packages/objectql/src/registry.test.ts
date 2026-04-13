import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry, computeFQN, parseFQN, RESERVED_NAMESPACES } from './registry';

describe('SchemaRegistry', () => {
    beforeEach(() => {
        SchemaRegistry.reset();
    });

    // ==========================================
    // FQN Computation Tests
    // ==========================================
    describe('computeFQN', () => {
        it('should compute FQN with namespace prefix', () => {
            expect(computeFQN('crm', 'account')).toBe('crm__account');
            expect(computeFQN('todo', 'task')).toBe('todo__task');
        });

        it('should not prefix reserved namespaces', () => {
            expect(computeFQN('base', 'user')).toBe('user');
            expect(computeFQN('system', 'organization')).toBe('organization');
        });

        it('should not prefix undefined namespace', () => {
            expect(computeFQN(undefined, 'task')).toBe('task');
        });
    });

    describe('parseFQN', () => {
        it('should parse FQN with namespace', () => {
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
            SchemaRegistry.registerNamespace('crm', 'com.example.crm');
            expect(SchemaRegistry.getNamespaceOwner('crm')).toBe('com.example.crm');
        });

        it('should allow same package to re-register namespace', () => {
            SchemaRegistry.registerNamespace('crm', 'com.example.crm');
            expect(() => {
                SchemaRegistry.registerNamespace('crm', 'com.example.crm');
            }).not.toThrow();
        });

        it('should allow multiple packages to share a namespace', () => {
            SchemaRegistry.registerNamespace('sys', 'com.objectstack.auth');
            SchemaRegistry.registerNamespace('sys', 'com.objectstack.security');
            // First registered package returned for backwards compat
            expect(SchemaRegistry.getNamespaceOwner('sys')).toBe('com.objectstack.auth');
            expect(SchemaRegistry.getNamespaceOwners('sys')).toEqual([
                'com.objectstack.auth',
                'com.objectstack.security',
            ]);
        });

        it('should unregister namespace', () => {
            SchemaRegistry.registerNamespace('crm', 'com.example.crm');
            SchemaRegistry.unregisterNamespace('crm', 'com.example.crm');
            expect(SchemaRegistry.getNamespaceOwner('crm')).toBeUndefined();
        });

        it('should keep namespace when one of multiple packages unregisters', () => {
            SchemaRegistry.registerNamespace('sys', 'com.objectstack.auth');
            SchemaRegistry.registerNamespace('sys', 'com.objectstack.setup');
            SchemaRegistry.unregisterNamespace('sys', 'com.objectstack.setup');
            expect(SchemaRegistry.getNamespaceOwner('sys')).toBe('com.objectstack.auth');
        });
    });

    // ==========================================
    // Object Ownership Tests
    // ==========================================
    describe('Object Ownership', () => {
        it('should register owned object with FQN', () => {
            const obj = { name: 'account', fields: { name: { type: 'text' } } };
            const fqn = SchemaRegistry.registerObject(obj as any, 'com.example.crm', 'crm', 'own');
            
            expect(fqn).toBe('crm__account');
            const resolved = SchemaRegistry.getObject('crm__account');
            expect(resolved).toBeDefined();
            expect(resolved?.name).toBe('crm__account');
        });

        it('should register object without namespace (legacy)', () => {
            const obj = { name: 'task', fields: {} };
            const fqn = SchemaRegistry.registerObject(obj as any, 'com.example.app');
            
            expect(fqn).toBe('task');
            expect(SchemaRegistry.getObject('task')).toBeDefined();
        });

        it('should allow only one owner per FQN', () => {
            // Register first owner
            const obj = { name: 'shared', fields: {} };
            SchemaRegistry.registerObject(obj as any, 'com.vendor.a', 'vendor_a', 'own');
            
            // Second vendor tries to own the same FQN via extension targeting
            // They cannot own an object that's already owned by another package
            const obj2 = { name: 'vendor_a__shared', fields: {} };
            expect(() => {
                SchemaRegistry.registerObject(obj2 as any, 'com.vendor.b', undefined, 'own');
            }).toThrow(/already owned/);
        });

        it('should allow re-registration by same owner', () => {
            const obj = { name: 'account', fields: { v1: { type: 'text' } } };
            SchemaRegistry.registerObject(obj as any, 'com.example.crm', 'crm', 'own');
            
            const obj2 = { name: 'account', fields: { v2: { type: 'text' } } };
            expect(() => {
                SchemaRegistry.registerObject(obj2 as any, 'com.example.crm', 'crm', 'own');
            }).not.toThrow();
            
            // Should have new fields
            const resolved = SchemaRegistry.getObject('crm__account');
            expect(resolved?.fields).toHaveProperty('v2');
        });
    });

    // ==========================================
    // Object Extension Tests
    // ==========================================
    describe('Object Extension', () => {
        it('should merge extension fields into owner', () => {
            const owner = { name: 'contact', fields: { email: { type: 'text' } } };
            SchemaRegistry.registerObject(owner as any, 'com.base', 'base', 'own');
            
            const ext = { name: 'contact', fields: { phone: { type: 'text' } } };
            SchemaRegistry.registerObject(ext as any, 'com.crm', undefined, 'extend', 200);
            
            const resolved = SchemaRegistry.getObject('contact');
            expect(resolved?.fields).toHaveProperty('email');
            expect(resolved?.fields).toHaveProperty('phone');
        });

        it('should apply priority order (higher wins)', () => {
            const owner = { name: 'task', label: 'Task', fields: {} };
            SchemaRegistry.registerObject(owner as any, 'com.base', 'base', 'own', 100);
            
            const ext1 = { name: 'task', label: 'Extended Task', fields: {} };
            SchemaRegistry.registerObject(ext1 as any, 'com.ext1', undefined, 'extend', 150);
            
            const ext2 = { name: 'task', label: 'Final Task', fields: {} };
            SchemaRegistry.registerObject(ext2 as any, 'com.ext2', undefined, 'extend', 250);
            
            const resolved = SchemaRegistry.getObject('task');
            expect(resolved?.label).toBe('Final Task'); // Higher priority wins
        });

        it('should merge validations additively', () => {
            const owner = { name: 'order', fields: {}, validations: [{ type: 'required', field: 'id' }] };
            SchemaRegistry.registerObject(owner as any, 'com.base', 'base', 'own');
            
            const ext = { name: 'order', fields: {}, validations: [{ type: 'required', field: 'status' }] };
            SchemaRegistry.registerObject(ext as any, 'com.ext', undefined, 'extend');
            
            const resolved = SchemaRegistry.getObject('order');
            expect(resolved?.validations).toHaveLength(2);
        });

        it('should fail extension without owner', () => {
            const ext = { name: 'phantom', fields: {} };
            SchemaRegistry.registerObject(ext as any, 'com.ext', undefined, 'extend');
            
            // Should not be resolvable (no owner)
            const resolved = SchemaRegistry.getObject('phantom');
            expect(resolved).toBeUndefined();
        });
    });

    // ==========================================
    // Object Resolution Tests
    // ==========================================
    describe('Object Resolution', () => {
        it('should resolve by FQN', () => {
            const obj = { name: 'deal', fields: {} };
            SchemaRegistry.registerObject(obj as any, 'com.crm', 'crm', 'own');
            
            expect(SchemaRegistry.resolveObject('crm__deal')).toBeDefined();
        });

        it('should resolve by short name (fallback)', () => {
            const obj = { name: 'task', fields: {} };
            SchemaRegistry.registerObject(obj as any, 'com.todo', 'todo', 'own');
            
            // Should find via fallback scan
            expect(SchemaRegistry.getObject('task')).toBeDefined();
        });

        it('should resolve by tableName (protocol name fallback)', () => {
            // Simulates ObjectSchema.create() which auto-derives tableName
            // as {namespace}_{name} (single underscore)
            const obj = { name: 'user', tableName: 'sys_user', namespace: 'sys', fields: {} };
            SchemaRegistry.registerObject(obj as any, 'com.objectstack.system', 'sys', 'own');
            
            // FQN is 'sys__user' (double underscore)
            expect(SchemaRegistry.getObject('sys__user')).toBeDefined();
            
            // Protocol name 'sys_user' (single underscore) should also resolve
            const resolved = SchemaRegistry.getObject('sys_user');
            expect(resolved).toBeDefined();
            expect(resolved?.name).toBe('sys__user');
            expect((resolved as any).tableName).toBe('sys_user');
        });

        it('should resolve by tableName for any namespace', () => {
            const obj = { name: 'account', tableName: 'crm_account', namespace: 'crm', fields: {} };
            SchemaRegistry.registerObject(obj as any, 'com.crm', 'crm', 'own');
            
            // FQN: 'crm__account', tableName: 'crm_account'
            expect(SchemaRegistry.getObject('crm__account')).toBeDefined();
            expect(SchemaRegistry.getObject('crm_account')).toBeDefined();
        });

        it('should cache merged objects', () => {
            const obj = { name: 'cached', fields: {} };
            SchemaRegistry.registerObject(obj as any, 'com.test', 'test', 'own');
            
            const first = SchemaRegistry.resolveObject('test__cached');
            const second = SchemaRegistry.resolveObject('test__cached');
            expect(first).toBe(second); // Same reference (cached)
        });

        it('should invalidate cache on re-registration', () => {
            const obj = { name: 'evolve', fields: { v1: { type: 'text' } } };
            SchemaRegistry.registerObject(obj as any, 'com.test', 'test', 'own');
            
            const first = SchemaRegistry.resolveObject('test__evolve');
            
            const obj2 = { name: 'evolve', fields: { v2: { type: 'text' } } };
            SchemaRegistry.registerObject(obj2 as any, 'com.test', 'test', 'own');
            
            const second = SchemaRegistry.resolveObject('test__evolve');
            expect(first).not.toBe(second); // Different reference (cache invalidated)
            expect(second?.fields).toHaveProperty('v2');
        });
    });

    // ==========================================
    // getAllObjects Tests
    // ==========================================
    describe('getAllObjects', () => {
        it('should return all merged objects', () => {
            SchemaRegistry.registerObject({ name: 'a', fields: {} } as any, 'com.pkg1', 'pkg1', 'own');
            SchemaRegistry.registerObject({ name: 'b', fields: {} } as any, 'com.pkg2', 'pkg2', 'own');
            
            const all = SchemaRegistry.getAllObjects();
            expect(all).toHaveLength(2);
            expect(all.map(o => o.name).sort()).toEqual(['pkg1__a', 'pkg2__b']);
        });

        it('should filter by packageId', () => {
            SchemaRegistry.registerObject({ name: 'a', fields: {} } as any, 'com.pkg1', 'pkg1', 'own');
            SchemaRegistry.registerObject({ name: 'b', fields: {} } as any, 'com.pkg2', 'pkg2', 'own');
            
            const filtered = SchemaRegistry.getAllObjects('com.pkg1');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe('pkg1__a');
        });

        it('should include objects where package is extender', () => {
            SchemaRegistry.registerObject({ name: 'base_obj', fields: {} } as any, 'com.owner', 'base', 'own');
            SchemaRegistry.registerObject({ name: 'base_obj', fields: { ext: { type: 'text' } } } as any, 'com.extender', undefined, 'extend');
            
            // Extender should see the object
            const filtered = SchemaRegistry.getAllObjects('com.extender');
            expect(filtered).toHaveLength(1);
        });
    });

    // ==========================================
    // Uninstall Tests
    // ==========================================
    describe('Uninstall', () => {
        it('should remove owner contribution', () => {
            SchemaRegistry.registerObject({ name: 'removable', fields: {} } as any, 'com.pkg', 'pkg', 'own');
            expect(SchemaRegistry.getObject('pkg__removable')).toBeDefined();
            
            SchemaRegistry.unregisterObjectsByPackage('com.pkg');
            expect(SchemaRegistry.getObject('pkg__removable')).toBeUndefined();
        });

        it('should remove extension contribution', () => {
            SchemaRegistry.registerObject({ name: 'target', fields: { base: { type: 'text' } } } as any, 'com.owner', 'base', 'own');
            SchemaRegistry.registerObject({ name: 'target', fields: { ext: { type: 'text' } } } as any, 'com.ext', undefined, 'extend');
            
            SchemaRegistry.unregisterObjectsByPackage('com.ext');
            
            const resolved = SchemaRegistry.getObject('target');
            expect(resolved?.fields).toHaveProperty('base');
            expect(resolved?.fields).not.toHaveProperty('ext');
        });

        it('should prevent uninstall of owner with active extenders', () => {
            SchemaRegistry.registerObject({ name: 'important', fields: {} } as any, 'com.owner', 'base', 'own');
            SchemaRegistry.registerObject({ name: 'important', fields: {} } as any, 'com.ext', undefined, 'extend');
            
            expect(() => {
                SchemaRegistry.unregisterObjectsByPackage('com.owner');
            }).toThrow(/extended by/);
        });

        it('should allow force uninstall of owner with extenders', () => {
            SchemaRegistry.registerObject({ name: 'forced', fields: {} } as any, 'com.owner', 'base', 'own');
            SchemaRegistry.registerObject({ name: 'forced', fields: {} } as any, 'com.ext', undefined, 'extend');
            
            expect(() => {
                SchemaRegistry.unregisterObjectsByPackage('com.owner', true);
            }).not.toThrow();
        });
    });

    // ==========================================
    // Contributors API Tests
    // ==========================================
    describe('Contributors API', () => {
        it('should return all contributors for object', () => {
            SchemaRegistry.registerObject({ name: 'multi', fields: {} } as any, 'com.owner', 'pkg', 'own', 100);
            SchemaRegistry.registerObject({ name: 'pkg__multi', fields: {} } as any, 'com.ext1', undefined, 'extend', 200);
            SchemaRegistry.registerObject({ name: 'pkg__multi', fields: {} } as any, 'com.ext2', undefined, 'extend', 300);
            
            const contribs = SchemaRegistry.getObjectContributors('pkg__multi');
            expect(contribs).toHaveLength(3);
            expect(contribs[0].priority).toBe(100); // Sorted by priority
            expect(contribs[1].priority).toBe(200);
            expect(contribs[2].priority).toBe(300);
        });

        it('should return owner contributor', () => {
            SchemaRegistry.registerObject({ name: 'owned', fields: {} } as any, 'com.owner', 'pkg', 'own');
            
            const owner = SchemaRegistry.getObjectOwner('pkg__owned');
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
            SchemaRegistry.registerItem('action', item, 'name', 'com.pkg');

            const retrieved = SchemaRegistry.getItem('action', 'test_action');
            expect(retrieved).toEqual(item);
        });

        it('should list items by type with package filter', () => {
            SchemaRegistry.registerItem('action', { name: 'a1' }, 'name', 'com.pkg1');
            SchemaRegistry.registerItem('action', { name: 'a2' }, 'name', 'com.pkg2');

            const filtered = SchemaRegistry.listItems('action', 'com.pkg1');
            expect(filtered).toHaveLength(1);
        });
    });

    // ==========================================
    // Package Management Tests
    // ==========================================
    describe('Package Management', () => {
        it('should install package with namespace', () => {
            const manifest = { id: 'com.test', name: 'Test', namespace: 'test', version: '1.0.0' };
            const pkg = SchemaRegistry.installPackage(manifest as any);
            
            expect(pkg.status).toBe('installed');
            expect(SchemaRegistry.getNamespaceOwner('test')).toBe('com.test');
        });

        it('should uninstall package and release namespace', () => {
            const manifest = { id: 'com.test', name: 'Test', namespace: 'test', version: '1.0.0' };
            SchemaRegistry.installPackage(manifest as any);
            
            SchemaRegistry.uninstallPackage('com.test');
            expect(SchemaRegistry.getPackage('com.test')).toBeUndefined();
            expect(SchemaRegistry.getNamespaceOwner('test')).toBeUndefined();
        });
    });

    // ==========================================
    // Reset Tests
    // ==========================================
    describe('Reset', () => {
        it('should clear all state', () => {
            SchemaRegistry.registerObject({ name: 'obj', fields: {} } as any, 'com.pkg', 'pkg', 'own');
            SchemaRegistry.registerItem('action', { name: 'act' }, 'name');

            SchemaRegistry.reset();

            expect(SchemaRegistry.getAllObjects()).toHaveLength(0);
            expect(SchemaRegistry.listItems('action')).toHaveLength(0);
        });
    });

    // ==========================================
    // listItems/getItem for 'object' type Tests
    // ==========================================
    describe('listItems and getItem for object type', () => {
        it('listItems("object") should return all registered objects', () => {
            SchemaRegistry.registerObject(
                { name: 'account', label: 'Account', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            SchemaRegistry.registerObject(
                { name: 'contact', label: 'Contact', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            
            const objects = SchemaRegistry.listItems('object');
            expect(objects).toHaveLength(2);
            expect(objects.map((o: any) => o.name).sort()).toEqual(['crm__account', 'crm__contact']);
        });

        it('listItems("objects") should return all registered objects (plural alias)', () => {
            SchemaRegistry.registerObject(
                { name: 'task', label: 'Task', fields: {} } as any,
                'com.todo',
                'todo',
                'own'
            );
            
            const objects = SchemaRegistry.listItems('objects');
            expect(objects).toHaveLength(1);
            expect((objects[0] as any).name).toBe('todo__task');
        });

        it('getItem("object", fqn) should return object by FQN', () => {
            SchemaRegistry.registerObject(
                { name: 'lead', label: 'Lead', fields: { status: { type: 'text' } } } as any,
                'com.crm',
                'crm',
                'own'
            );
            
            const obj = SchemaRegistry.getItem('object', 'crm__lead');
            expect(obj).toBeDefined();
            expect((obj as any).name).toBe('crm__lead');
            expect((obj as any).label).toBe('Lead');
        });

        it('getItem("object", shortName) should return object by short name fallback', () => {
            SchemaRegistry.registerObject(
                { name: 'opportunity', label: 'Opportunity', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            
            const obj = SchemaRegistry.getItem('object', 'opportunity');
            expect(obj).toBeDefined();
            expect((obj as any).name).toBe('crm__opportunity');
        });

        it('listItems("object", packageId) should filter by package', () => {
            SchemaRegistry.registerObject(
                { name: 'account', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            SchemaRegistry.registerObject(
                { name: 'task', fields: {} } as any,
                'com.todo',
                'todo',
                'own'
            );
            
            const crmObjects = SchemaRegistry.listItems('object', 'com.crm');
            expect(crmObjects).toHaveLength(1);
            expect((crmObjects[0] as any).name).toBe('crm__account');

            const todoObjects = SchemaRegistry.listItems('object', 'com.todo');
            expect(todoObjects).toHaveLength(1);
            expect((todoObjects[0] as any).name).toBe('todo__task');
        });
    });
});