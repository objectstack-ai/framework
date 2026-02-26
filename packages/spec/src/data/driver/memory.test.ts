import { describe, it, expect } from 'vitest';
import {
  MemoryConfigSchema,
  MemoryPersistenceConfigSchema,
  MemoryDriverSpec,
  PersistenceTypeSchema,
  FilePersistenceConfigSchema,
  LocalStoragePersistenceConfigSchema,
  CustomPersistenceConfigSchema,
  PersistenceAdapterSchema,
} from './memory.zod';

describe('MemoryConfigSchema', () => {
  it('should accept empty config (all optional)', () => {
    const config = MemoryConfigSchema.parse({});

    expect(config.strictMode).toBe(false);
    expect(config.initialData).toBeUndefined();
    expect(config.persistence).toBeUndefined();
    expect(config.indexes).toBeUndefined();
    expect(config.maxRecordsPerObject).toBeUndefined();
  });

  it('should accept config with initial data', () => {
    const config = MemoryConfigSchema.parse({
      initialData: {
        users: [
          { id: '1', name: 'Alice', email: 'alice@example.com' },
          { id: '2', name: 'Bob', email: 'bob@example.com' },
        ],
        posts: [
          { id: '1', title: 'Hello World', author_id: '1' },
        ],
      },
    });

    expect(config.initialData).toBeDefined();
    expect(config.initialData!.users).toHaveLength(2);
    expect(config.initialData!.posts).toHaveLength(1);
  });

  it('should accept config with strict mode', () => {
    const config = MemoryConfigSchema.parse({
      strictMode: true,
    });

    expect(config.strictMode).toBe(true);
  });

  it('should accept persistence shorthand "file"', () => {
    const config = MemoryConfigSchema.parse({
      persistence: 'file',
    });

    expect(config.persistence).toBe('file');
  });

  it('should accept persistence shorthand "local"', () => {
    const config = MemoryConfigSchema.parse({
      persistence: 'local',
    });

    expect(config.persistence).toBe('local');
  });

  it('should accept persistence with file object config', () => {
    const config = MemoryConfigSchema.parse({
      persistence: {
        type: 'file',
        path: '/tmp/data.json',
        autoSaveInterval: 10000,
      },
    });

    expect(config.persistence).toBeDefined();
    const p = config.persistence as { type: 'file'; path?: string; autoSaveInterval: number };
    expect(p.type).toBe('file');
    expect(p.path).toBe('/tmp/data.json');
    expect(p.autoSaveInterval).toBe(10000);
  });

  it('should apply file persistence autoSaveInterval default', () => {
    const config = MemoryConfigSchema.parse({
      persistence: {
        type: 'file',
        path: '/tmp/data.json',
      },
    });

    const p = config.persistence as { type: 'file'; autoSaveInterval: number };
    expect(p.autoSaveInterval).toBe(2000);
  });

  it('should accept persistence with local object config', () => {
    const config = MemoryConfigSchema.parse({
      persistence: {
        type: 'local',
        key: 'myapp:db',
      },
    });

    const p = config.persistence as { type: 'local'; key?: string };
    expect(p.type).toBe('local');
    expect(p.key).toBe('myapp:db');
  });

  it('should accept persistence with custom adapter', () => {
    const mockAdapter = {
      load: async () => null,
      save: async () => {},
      flush: async () => {},
    };
    const config = MemoryConfigSchema.parse({
      persistence: { adapter: mockAdapter },
    });

    expect(config.persistence).toBeDefined();
    const p = config.persistence as { adapter: any };
    expect(typeof p.adapter.load).toBe('function');
    expect(typeof p.adapter.save).toBe('function');
    expect(typeof p.adapter.flush).toBe('function');
  });

  it('should accept config with indexes', () => {
    const config = MemoryConfigSchema.parse({
      indexes: {
        users: ['email', 'role'],
        posts: ['author_id', 'status'],
      },
    });

    expect(config.indexes).toBeDefined();
    expect(config.indexes!.users).toEqual(['email', 'role']);
    expect(config.indexes!.posts).toEqual(['author_id', 'status']);
  });

  it('should accept config with maxRecordsPerObject', () => {
    const config = MemoryConfigSchema.parse({
      maxRecordsPerObject: 10000,
    });

    expect(config.maxRecordsPerObject).toBe(10000);
  });

  it('should accept full config with all options', () => {
    const config = MemoryConfigSchema.parse({
      initialData: {
        users: [{ id: '1', name: 'Alice' }],
      },
      strictMode: true,
      persistence: {
        type: 'file',
        path: '/var/data/memory.json',
        autoSaveInterval: 3000,
      },
      indexes: {
        users: ['email'],
      },
      maxRecordsPerObject: 50000,
    });

    expect(config.strictMode).toBe(true);
    expect(config.initialData!.users).toHaveLength(1);
    const p = config.persistence as { type: 'file'; path?: string };
    expect(p.path).toBe('/var/data/memory.json');
    expect(config.indexes!.users).toEqual(['email']);
    expect(config.maxRecordsPerObject).toBe(50000);
  });

  it('should reject file persistence with invalid autoSaveInterval', () => {
    expect(() => MemoryConfigSchema.parse({
      persistence: {
        type: 'file',
        path: '/tmp/data.json',
        autoSaveInterval: 50, // Below minimum of 100
      },
    })).toThrow();
  });

  it('should reject invalid persistence string', () => {
    expect(() => MemoryConfigSchema.parse({
      persistence: 'indexeddb',
    })).toThrow();
  });

  it('should reject maxRecordsPerObject less than 1', () => {
    expect(() => MemoryConfigSchema.parse({
      maxRecordsPerObject: 0,
    })).toThrow();
  });

  it('should reject strictMode with invalid type', () => {
    expect(() => MemoryConfigSchema.parse({
      strictMode: 'yes',
    })).toThrow();
  });
});

describe('PersistenceTypeSchema', () => {
  it('should accept file type', () => {
    expect(PersistenceTypeSchema.parse('file')).toBe('file');
  });

  it('should accept local type', () => {
    expect(PersistenceTypeSchema.parse('local')).toBe('local');
  });

  it('should reject invalid type', () => {
    expect(() => PersistenceTypeSchema.parse('indexeddb')).toThrow();
  });
});

describe('FilePersistenceConfigSchema', () => {
  it('should accept valid file persistence config', () => {
    const config = FilePersistenceConfigSchema.parse({
      type: 'file',
      path: '/data/store.json',
      autoSaveInterval: 10000,
    });

    expect(config.type).toBe('file');
    expect(config.path).toBe('/data/store.json');
    expect(config.autoSaveInterval).toBe(10000);
  });

  it('should apply default autoSaveInterval', () => {
    const config = FilePersistenceConfigSchema.parse({
      type: 'file',
      path: '/data/store.json',
    });

    expect(config.autoSaveInterval).toBe(2000);
  });

  it('should accept without path (uses default)', () => {
    const config = FilePersistenceConfigSchema.parse({
      type: 'file',
    });

    expect(config.type).toBe('file');
    expect(config.path).toBeUndefined();
  });
});

describe('LocalStoragePersistenceConfigSchema', () => {
  it('should accept valid localStorage persistence config', () => {
    const config = LocalStoragePersistenceConfigSchema.parse({
      type: 'local',
      key: 'myapp:db',
    });

    expect(config.type).toBe('local');
    expect(config.key).toBe('myapp:db');
  });

  it('should accept without key (uses default)', () => {
    const config = LocalStoragePersistenceConfigSchema.parse({
      type: 'local',
    });

    expect(config.type).toBe('local');
    expect(config.key).toBeUndefined();
  });
});

describe('CustomPersistenceConfigSchema', () => {
  it('should accept valid custom adapter', () => {
    const config = CustomPersistenceConfigSchema.parse({
      adapter: {
        load: async () => null,
        save: async () => {},
        flush: async () => {},
      },
    });

    expect(typeof config.adapter.load).toBe('function');
    expect(typeof config.adapter.save).toBe('function');
    expect(typeof config.adapter.flush).toBe('function');
  });
});

describe('MemoryPersistenceConfigSchema', () => {
  it('should accept shorthand "file"', () => {
    const config = MemoryPersistenceConfigSchema.parse('file');
    expect(config).toBe('file');
  });

  it('should accept shorthand "local"', () => {
    const config = MemoryPersistenceConfigSchema.parse('local');
    expect(config).toBe('local');
  });

  it('should accept file object config', () => {
    const config = MemoryPersistenceConfigSchema.parse({
      type: 'file',
      path: '/tmp/data.json',
    });
    expect(config).toEqual({ type: 'file', path: '/tmp/data.json', autoSaveInterval: 2000 });
  });

  it('should accept local object config', () => {
    const config = MemoryPersistenceConfigSchema.parse({
      type: 'local',
      key: 'myapp:db',
    });
    expect(config).toEqual({ type: 'local', key: 'myapp:db' });
  });

  it('should accept custom adapter', () => {
    const adapter = {
      load: async () => null,
      save: async () => {},
      flush: async () => {},
    };
    const config = MemoryPersistenceConfigSchema.parse({ adapter });
    expect((config as any).adapter).toBeDefined();
  });

  it('should reject invalid string', () => {
    expect(() => MemoryPersistenceConfigSchema.parse('redis')).toThrow();
  });
});

describe('MemoryDriverSpec', () => {
  it('should have correct id', () => {
    expect(MemoryDriverSpec.id).toBe('memory');
  });

  it('should have correct label', () => {
    expect(MemoryDriverSpec.label).toBe('In-Memory');
  });

  it('should have a description', () => {
    expect(MemoryDriverSpec.description).toBeDefined();
    expect(typeof MemoryDriverSpec.description).toBe('string');
  });

  it('should have an icon', () => {
    expect(MemoryDriverSpec.icon).toBe('memory');
  });

  it('should have capabilities defined', () => {
    expect(MemoryDriverSpec.capabilities).toBeDefined();
  });

  it('should support transactions', () => {
    expect(MemoryDriverSpec.capabilities!.transactions).toBe(true);
  });

  it('should support core query features', () => {
    expect(MemoryDriverSpec.capabilities!.queryFilters).toBe(true);
    expect(MemoryDriverSpec.capabilities!.queryAggregations).toBe(true);
    expect(MemoryDriverSpec.capabilities!.querySorting).toBe(true);
    expect(MemoryDriverSpec.capabilities!.queryPagination).toBe(true);
  });

  it('should not support advanced query features', () => {
    expect(MemoryDriverSpec.capabilities!.joins).toBe(false);
    expect(MemoryDriverSpec.capabilities!.queryWindowFunctions).toBe(false);
    expect(MemoryDriverSpec.capabilities!.querySubqueries).toBe(false);
    expect(MemoryDriverSpec.capabilities!.fullTextSearch).toBe(false);
  });

  it('should support dynamic schema', () => {
    expect(MemoryDriverSpec.capabilities!.dynamicSchema).toBe(true);
  });
});
