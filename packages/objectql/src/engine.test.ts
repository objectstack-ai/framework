import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectQL } from './engine';
import { SchemaRegistry } from './registry';
import type { IDataDriver } from '@objectstack/spec/contracts';

// Mock the SchemaRegistry to avoid side effects between tests
vi.mock('./registry', () => {
  const mockObjects = new Map();
  return {
    SchemaRegistry: {
      getObject: vi.fn((name) => mockObjects.get(name)),
      resolveObject: vi.fn((name) => mockObjects.get(name)),
      registerObject: vi.fn((obj, packageId, namespace, ownership, priority) => {
        const fqn = namespace ? `${namespace}__${obj.name}` : obj.name;
        mockObjects.set(fqn, { ...obj, name: fqn });
        return fqn;
      }),
      registerNamespace: vi.fn(),
      registerKind: vi.fn(),
      registerItem: vi.fn(),
      registerApp: vi.fn(),
      installPackage: vi.fn((manifest) => ({
        manifest,
        status: 'installed',
        enabled: true,
        installedAt: new Date().toISOString(),
      })),
      reset: vi.fn(() => mockObjects.clear()),
      metadata: {
        get: vi.fn(() => mockObjects) // Expose for verification if needed
      }
    }
  };
});

describe('ObjectQL Engine', () => {
    let engine: ObjectQL;
    let mockDriver: IDataDriver;
    let mockDriver2: IDataDriver;

    beforeEach(() => {
        // Clear Registry Mocks
        vi.clearAllMocks();
        
        // Setup Drivers
        mockDriver = {
            name: 'default-driver',
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            find: vi.fn().mockResolvedValue([{ id: '1', name: 'Test Record' }]),
            findOne: vi.fn(),
            create: vi.fn().mockResolvedValue({ id: '1', success: true }),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
            capabilities: {} as any // Simplified
        } as unknown as IDataDriver;

        mockDriver2 = {
            name: 'mongo',
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            find: vi.fn().mockResolvedValue([{ id: '2', name: 'Mongo Record' }]),
            findOne: vi.fn(),
            create: vi.fn().mockResolvedValue({ id: '2', success: true }),
            update: vi.fn(),
            delete: vi.fn(),
            count: vi.fn(),
            capabilities: {} as any
        } as unknown as IDataDriver;

        engine = new ObjectQL();
    });

    describe('Initialization', () => {
        it('should initialize with default logger', () => {
            expect(engine).toBeDefined();
            expect(engine.getStatus().status).toBe('running');
        });

        it('should register and connect drivers on init', async () => {
            engine.registerDriver(mockDriver, true);
            await engine.init();
            expect(mockDriver.connect).toHaveBeenCalled();
        });
    });

    describe('Metadata Registration', () => {
        it('should register objects from app manifest with namespace', () => {
            const manifest = {
                id: 'com.example.app',
                namespace: 'example',
                objects: [
                    { name: 'task', fields: {} }
                ]
            };
            
            engine.registerApp(manifest);
            expect(SchemaRegistry.registerObject).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'task' }), 
                'com.example.app',
                'example',
                'own'
            );
        });

        it('should register objects without namespace (legacy)', () => {
            const manifest = {
                id: 'com.legacy.app',
                objects: [
                    { name: 'item', fields: {} }
                ]
            };
            
            engine.registerApp(manifest);
            expect(SchemaRegistry.registerObject).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'item' }), 
                'com.legacy.app',
                undefined,
                'own'
            );
        });

        it('should register object extensions', () => {
            const manifest = {
                id: 'com.extender.app',
                namespace: 'ext',
                objectExtensions: [
                    { extend: 'base__contact', fields: { custom_field: { type: 'text' } }, priority: 250 }
                ]
            };
            
            engine.registerApp(manifest);
            expect(SchemaRegistry.registerObject).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'base__contact' }),
                'com.extender.app',
                undefined,
                'extend',
                250
            );
        });

        it('should register kinds from app manifest', () => {
            const manifest = {
                id: 'com.example.app',
                contributes: {
                    kinds: [{ id: 'test.kind', description: 'Test Kind' }]
                }
            };
            
            engine.registerApp(manifest);
            expect(SchemaRegistry.registerKind).toHaveBeenCalledWith(expect.objectContaining({ id: 'test.kind' }));
        });
    });

    describe('Driver Routing', () => {
        beforeEach(async () => {
            // Setup:
            // - Default Driver: mockDriver
            // - Specific Driver: mockDriver2 (named 'mongo')
            engine.registerDriver(mockDriver, true);
            engine.registerDriver(mockDriver2);
            await engine.init();
        });

        it('should route to default driver when no datasource is specified', async () => {
            // Mock Schema: Object uses default datasource
            vi.mocked(SchemaRegistry.getObject).mockReturnValue({ name: 'task', datasource: 'default', fields: {} });

            await engine.find('task', { filters: [] });
            
            expect(mockDriver.find).toHaveBeenCalled();
            expect(mockDriver2.find).not.toHaveBeenCalled();
        });

        it('should route to specific driver when datasource is specified', async () => {
            // Mock Schema: Object uses 'mongo' datasource
            vi.mocked(SchemaRegistry.getObject).mockReturnValue({ name: 'log', datasource: 'mongo', fields: {} });

            await engine.find('log', { filters: [] });
            
            expect(mockDriver.find).not.toHaveBeenCalled();
            expect(mockDriver2.find).toHaveBeenCalled();
        });

        it('should throw error if datasource is not found', async () => {
             // Mock Schema: Object uses unknown datasource
             vi.mocked(SchemaRegistry.getObject).mockReturnValue({ name: 'old_data', datasource: 'legacy_sql', fields: {} });

             await expect(engine.find('old_data', {})).rejects.toThrow("Datasource 'legacy_sql' configured for object 'old_data' is not registered");
        });
    });

    describe('CRUD Operations', () => {
        beforeEach(async () => {
            engine.registerDriver(mockDriver, true);
            await engine.init();
            vi.mocked(SchemaRegistry.getObject).mockReturnValue({ name: 'task', fields: {} });
        });

        it('should execute insert operation', async () => {
            const result = await engine.insert('task', { title: 'New Task' });
            expect(mockDriver.create).toHaveBeenCalledWith('task', { title: 'New Task' }, undefined);
            expect(result).toEqual({ id: '1', success: true });
        });

        it('should execute find operation', async () => {
            const result = await engine.find('task', {});
            expect(mockDriver.find).toHaveBeenCalled();
            expect(result).toHaveLength(1);
        });
    });

    describe('Expand Related Records', () => {
        beforeEach(async () => {
            engine.registerDriver(mockDriver, true);
            await engine.init();
        });

        it('should expand lookup fields by replacing IDs with full objects', async () => {
            // Setup: task has a lookup field "assignee" → user object
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                        title: { type: 'text' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {
                        name: { type: 'text' },
                    },
                } as any;
                return undefined;
            });

            // Primary find returns tasks with assignee IDs
            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', title: 'Task 1', assignee: 'u1' },
                    { id: 't2', title: 'Task 2', assignee: 'u2' },
                ])
                // Second call (expand): returns user records
                .mockResolvedValueOnce([
                    { id: 'u1', name: 'Alice' },
                    { id: 'u2', name: 'Bob' },
                ]);

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });

            expect(result).toHaveLength(2);
            expect(result[0].assignee).toEqual({ id: 'u1', name: 'Alice' });
            expect(result[1].assignee).toEqual({ id: 'u2', name: 'Bob' });

            // Verify the expand query used $in
            expect(mockDriver.find).toHaveBeenCalledTimes(2);
            expect(mockDriver.find).toHaveBeenLastCalledWith(
                'user',
                expect.objectContaining({
                    object: 'user',
                    where: { id: { $in: ['u1', 'u2'] } },
                }),
            );
        });

        it('should expand master_detail fields', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'order_item') return {
                    name: 'order_item',
                    fields: {
                        order: { type: 'master_detail', reference: 'order' },
                    },
                } as any;
                if (name === 'order') return {
                    name: 'order',
                    fields: { total: { type: 'number' } },
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 'oi1', order: 'o1' },
                ])
                .mockResolvedValueOnce([
                    { id: 'o1', total: 100 },
                ]);

            const result = await engine.find('order_item', { expand: { order: { object: 'order' } } });
            expect(result[0].order).toEqual({ id: 'o1', total: 100 });
        });

        it('should skip expand for fields without reference definition', async () => {
            vi.mocked(SchemaRegistry.getObject).mockReturnValue({
                name: 'task',
                fields: {
                    title: { type: 'text' }, // Not a lookup
                },
            } as any);

            vi.mocked(mockDriver.find).mockResolvedValueOnce([
                { id: 't1', title: 'Task 1' },
            ]);

            const result = await engine.find('task', { expand: { title: { object: 'title' } } });
            expect(result[0].title).toBe('Task 1'); // Unchanged
            expect(mockDriver.find).toHaveBeenCalledTimes(1); // No expand query
        });

        it('should skip expand if schema is not registered', async () => {
            vi.mocked(SchemaRegistry.getObject).mockReturnValue(undefined);

            vi.mocked(mockDriver.find).mockResolvedValueOnce([
                { id: 't1', assignee: 'u1' },
            ]);

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });
            expect(result[0].assignee).toBe('u1'); // Unchanged — raw ID
            expect(mockDriver.find).toHaveBeenCalledTimes(1);
        });

        it('should handle null values gracefully during expand', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', assignee: null },
                    { id: 't2', assignee: 'u1' },
                ])
                .mockResolvedValueOnce([
                    { id: 'u1', name: 'Alice' },
                ]);

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });
            expect(result[0].assignee).toBeNull();
            expect(result[1].assignee).toEqual({ id: 'u1', name: 'Alice' });
        });

        it('should de-duplicate foreign key IDs in batch query', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', assignee: 'u1' },
                    { id: 't2', assignee: 'u1' }, // Same user
                    { id: 't3', assignee: 'u2' },
                ])
                .mockResolvedValueOnce([
                    { id: 'u1', name: 'Alice' },
                    { id: 'u2', name: 'Bob' },
                ]);

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });

            // Verify only 2 unique IDs queried
            expect(mockDriver.find).toHaveBeenLastCalledWith(
                'user',
                expect.objectContaining({
                    where: { id: { $in: ['u1', 'u2'] } },
                }),
            );
            expect(result[0].assignee).toEqual({ id: 'u1', name: 'Alice' });
            expect(result[1].assignee).toEqual({ id: 'u1', name: 'Alice' });
        });

        it('should keep raw ID when referenced record not found', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', assignee: 'u_deleted' },
                ])
                .mockResolvedValueOnce([]); // No records found

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });
            expect(result[0].assignee).toBe('u_deleted'); // Fallback to raw ID
        });

        it('should expand multiple fields in a single query', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                        project: { type: 'lookup', reference: 'project' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                if (name === 'project') return {
                    name: 'project',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', assignee: 'u1', project: 'p1' },
                ])
                .mockResolvedValueOnce([{ id: 'u1', name: 'Alice' }])
                .mockResolvedValueOnce([{ id: 'p1', name: 'Project X' }]);

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' }, project: { object: 'project' } } });

            expect(result[0].assignee).toEqual({ id: 'u1', name: 'Alice' });
            expect(result[0].project).toEqual({ id: 'p1', name: 'Project X' });
            expect(mockDriver.find).toHaveBeenCalledTimes(3);
        });

        it('should work with findOne and expand', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.findOne as any).mockResolvedValueOnce(
                { id: 't1', title: 'Task 1', assignee: 'u1' },
            );
            vi.mocked(mockDriver.find).mockResolvedValueOnce([
                { id: 'u1', name: 'Alice' },
            ]);

            const result = await engine.findOne('task', { expand: { assignee: { object: 'assignee' } } });

            expect(result.assignee).toEqual({ id: 'u1', name: 'Alice' });
        });

        it('should handle already-expanded objects (skip re-expansion)', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            // Driver returns an already-expanded object
            vi.mocked(mockDriver.find).mockResolvedValueOnce([
                { id: 't1', assignee: { id: 'u1', name: 'Alice' } },
            ]);

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });

            // No expand query should have been made — the value was already an object
            expect(mockDriver.find).toHaveBeenCalledTimes(1);
            expect(result[0].assignee).toEqual({ id: 'u1', name: 'Alice' });
        });

        it('should gracefully handle expand errors and keep raw IDs', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        assignee: { type: 'lookup', reference: 'user' },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', assignee: 'u1' },
                ])
                .mockRejectedValueOnce(new Error('Driver connection failed'));

            const result = await engine.find('task', { expand: { assignee: { object: 'assignee' } } });
            expect(result[0].assignee).toBe('u1'); // Kept raw ID
        });

        it('should handle multi-value lookup fields (arrays)', async () => {
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                if (name === 'task') return {
                    name: 'task',
                    fields: {
                        watchers: { type: 'lookup', reference: 'user', multiple: true },
                    },
                } as any;
                if (name === 'user') return {
                    name: 'user',
                    fields: {},
                } as any;
                return undefined;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([
                    { id: 't1', watchers: ['u1', 'u2'] },
                ])
                .mockResolvedValueOnce([
                    { id: 'u1', name: 'Alice' },
                    { id: 'u2', name: 'Bob' },
                ]);

            const result = await engine.find('task', { expand: { watchers: { object: 'watchers' } } });
            expect(result[0].watchers).toEqual([
                { id: 'u1', name: 'Alice' },
                { id: 'u2', name: 'Bob' },
            ]);
        });

        it('should expand only fields specified in the expand map (populate creates flat expand)', async () => {
            // populate: ['project'] creates expand: { project: { object: 'project' } } (1 level only)
            // Nested fields like project.org should NOT be expanded unless explicitly nested in the AST
            vi.mocked(SchemaRegistry.getObject).mockImplementation((name) => {
                const schemas: Record<string, any> = {
                    task: { name: 'task', fields: { project: { type: 'lookup', reference: 'project' } } },
                    project: { name: 'project', fields: { org: { type: 'lookup', reference: 'org' } } },
                };
                return schemas[name] as any;
            });

            vi.mocked(mockDriver.find)
                .mockResolvedValueOnce([{ id: 't1', project: 'p1' }])  // find task
                .mockResolvedValueOnce([{ id: 'p1', org: 'o1' }]);     // expand project (depth 0)
                // org should NOT be expanded further — flat populate doesn't create nested expand

            const result = await engine.find('task', { expand: { project: { object: 'project' } } });

            // Project expanded, but org inside project remains as raw ID
            expect(result[0].project).toEqual({ id: 'p1', org: 'o1' });
            expect(mockDriver.find).toHaveBeenCalledTimes(2); // Only primary + 1 expand query
        });

        it('should return records unchanged when expand map is empty', async () => {
            vi.mocked(SchemaRegistry.getObject).mockReturnValue({
                name: 'task',
                fields: {},
            } as any);

            vi.mocked(mockDriver.find).mockResolvedValueOnce([
                { id: 't1', title: 'Task 1' },
            ]);

            const result = await engine.find('task', {});
            expect(result).toEqual([{ id: 't1', title: 'Task 1' }]);
            expect(mockDriver.find).toHaveBeenCalledTimes(1);
        });
    });
});
