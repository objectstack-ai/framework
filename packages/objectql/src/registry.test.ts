import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaRegistry, computeFQN, parseFQN, RESERVED_NAMESPACES } from './registry';

describe('SchemaRegistry', () => {
    let registry: SchemaRegistry;
    beforeEach(() => {
        registry = new SchemaRegistry();
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
        it('should register owned object with FQN', () => {
            const obj = { name: 'account', fields: { name: { type: 'text' } } };
            const fqn = registry.registerObject(obj as any, 'com.example.crm', 'crm', 'own');
            
            expect(fqn).toBe('crm__account');
            const resolved = registry.getObject('crm__account');
            expect(resolved).toBeDefined();
            expect(resolved?.name).toBe('crm__account');
        });

        it('should register object without namespace (legacy)', () => {
            const obj = { name: 'task', fields: {} };
            const fqn = registry.registerObject(obj as any, 'com.example.app');
            
            expect(fqn).toBe('task');
            expect(registry.getObject('task')).toBeDefined();
        });

        it('should allow only one owner per FQN', () => {
            // Register first owner
            const obj = { name: 'shared', fields: {} };
            registry.registerObject(obj as any, 'com.vendor.a', 'vendor_a', 'own');
            
            // Second vendor tries to own the same FQN via extension targeting
            // They cannot own an object that's already owned by another package
            const obj2 = { name: 'vendor_a__shared', fields: {} };
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
            
            // Should have new fields
            const resolved = registry.getObject('crm__account');
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
            expect(resolved?.label).toBe('Final Task'); // Higher priority wins
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
            
            // Should not be resolvable (no owner)
            const resolved = registry.getObject('phantom');
            expect(resolved).toBeUndefined();
        });
    });

    // ==========================================
    // Object Resolution Tests
    // ==========================================
    describe('Object Resolution', () => {
        it('should resolve by FQN', () => {
            const obj = { name: 'deal', fields: {} };
            registry.registerObject(obj as any, 'com.crm', 'crm', 'own');
            
            expect(registry.resolveObject('crm__deal')).toBeDefined();
        });

        it('should resolve by short name (fallback)', () => {
            const obj = { name: 'task', fields: {} };
            registry.registerObject(obj as any, 'com.todo', 'todo', 'own');
            
            // Should find via fallback scan
            expect(registry.getObject('task')).toBeDefined();
        });

        it('should resolve system objects by their literal short name', () => {
            // System objects use sys_ prefix as part of the short name itself.
            const obj = { name: 'sys_user', fields: {} };
            registry.registerObject(obj as any, 'com.objectstack.system', 'sys', 'own');

            // Both FQN and short-name lookup should resolve
            expect(registry.getObject('sys__sys_user')).toBeDefined();
            expect(registry.getObject('sys_user')).toBeDefined();
        });

        it('should resolve namespaced objects by FQN or short name, not by single-underscore concatenation', () => {
            const obj = { name: 'account', fields: {} };
            registry.registerObject(obj as any, 'com.crm', 'crm', 'own');

            // FQN works (cross-package disambiguation)
            expect(registry.getObject('crm__account')).toBeDefined();
            // Short name works (canonical user-facing form)
            expect(registry.getObject('account')).toBeDefined();
            // Single-underscore concatenation must NOT resolve — that ambiguity is the whole reason for FQN
            expect(registry.getObject('crm_account')).toBeUndefined();
        });

        it('should cache merged objects', () => {
            const obj = { name: 'cached', fields: {} };
            registry.registerObject(obj as any, 'com.test', 'test', 'own');
            
            const first = registry.resolveObject('test__cached');
            const second = registry.resolveObject('test__cached');
            expect(first).toBe(second); // Same reference (cached)
        });

        it('should invalidate cache on re-registration', () => {
            const obj = { name: 'evolve', fields: { v1: { type: 'text' } } };
            registry.registerObject(obj as any, 'com.test', 'test', 'own');
            
            const first = registry.resolveObject('test__evolve');
            
            const obj2 = { name: 'evolve', fields: { v2: { type: 'text' } } };
            registry.registerObject(obj2 as any, 'com.test', 'test', 'own');
            
            const second = registry.resolveObject('test__evolve');
            expect(first).not.toBe(second); // Different reference (cache invalidated)
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
            expect(all.map(o => o.name).sort()).toEqual(['pkg1__a', 'pkg2__b']);
        });

        it('should filter by packageId', () => {
            registry.registerObject({ name: 'a', fields: {} } as any, 'com.pkg1', 'pkg1', 'own');
            registry.registerObject({ name: 'b', fields: {} } as any, 'com.pkg2', 'pkg2', 'own');
            
            const filtered = registry.getAllObjects('com.pkg1');
            expect(filtered).toHaveLength(1);
            expect(filtered[0].name).toBe('pkg1__a');
        });

        it('should include objects where package is extender', () => {
            registry.registerObject({ name: 'base_obj', fields: {} } as any, 'com.owner', 'base', 'own');
            registry.registerObject({ name: 'base_obj', fields: { ext: { type: 'text' } } } as any, 'com.extender', undefined, 'extend');
            
            // Extender should see the object
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
            expect(registry.getObject('pkg__removable')).toBeDefined();
            
            registry.unregisterObjectsByPackage('com.pkg');
            expect(registry.getObject('pkg__removable')).toBeUndefined();
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
            registry.registerObject({ name: 'pkg__multi', fields: {} } as any, 'com.ext1', undefined, 'extend', 200);
            registry.registerObject({ name: 'pkg__multi', fields: {} } as any, 'com.ext2', undefined, 'extend', 300);
            
            const contribs = registry.getObjectContributors('pkg__multi');
            expect(contribs).toHaveLength(3);
            expect(contribs[0].priority).toBe(100); // Sorted by priority
            expect(contribs[1].priority).toBe(200);
            expect(contribs[2].priority).toBe(300);
        });

        it('should return owner contributor', () => {
            registry.registerObject({ name: 'owned', fields: {} } as any, 'com.owner', 'pkg', 'own');
            
            const owner = registry.getObjectOwner('pkg__owned');
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
            expect(objects.map((o: any) => o.name).sort()).toEqual(['crm__account', 'crm__contact']);
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
            expect((objects[0] as any).name).toBe('todo__task');
        });

        it('getItem("object", fqn) should return object by FQN', () => {
            registry.registerObject(
                { name: 'lead', label: 'Lead', fields: { status: { type: 'text' } } } as any,
                'com.crm',
                'crm',
                'own'
            );
            
            const obj = registry.getItem('object', 'crm__lead');
            expect(obj).toBeDefined();
            expect((obj as any).name).toBe('crm__lead');
            expect((obj as any).label).toBe('Lead');
        });

        it('getItem("object", shortName) should return object by short name fallback', () => {
            registry.registerObject(
                { name: 'opportunity', label: 'Opportunity', fields: {} } as any,
                'com.crm',
                'crm',
                'own'
            );
            
            const obj = registry.getItem('object', 'opportunity');
            expect(obj).toBeDefined();
            expect((obj as any).name).toBe('crm__opportunity');
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
            expect((crmObjects[0] as any).name).toBe('crm__account');

            const todoObjects = registry.listItems('object', 'com.todo');
            expect(todoObjects).toHaveLength(1);
            expect((todoObjects[0] as any).name).toBe('todo__task');
        });
    });
});