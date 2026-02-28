import { describe, it, expect } from 'vitest';
import {
  ObjectQLCapabilitiesSchema,
  ObjectUICapabilitiesSchema,
  ObjectOSCapabilitiesSchema,
  ObjectStackCapabilitiesSchema,
  ObjectStackDefinitionSchema,
  defineStack,
  type ObjectQLCapabilities,
  type ObjectUICapabilities,
  type ObjectOSCapabilities,
  type ObjectStackCapabilities,
  type ObjectStackDefinitionInput,
} from './stack.zod';

describe('ObjectQLCapabilitiesSchema', () => {
  it('should accept valid ObjectQL capabilities with all features enabled', () => {
    const capabilities: ObjectQLCapabilities = {
      queryFilters: true,
      queryAggregations: true,
      querySorting: true,
      queryPagination: true,
      queryWindowFunctions: true,
      querySubqueries: true,
      queryDistinct: true,
      queryHaving: true,
      queryJoins: true,
      fullTextSearch: true,
      vectorSearch: true,
      geoSpatial: true,
      jsonFields: true,
      arrayFields: true,
      validationRules: true,
      workflows: true,
      triggers: true,
      formulas: true,
      transactions: true,
      bulkOperations: true,
      supportedDrivers: ['postgresql', 'mongodb', 'mysql'],
    };

    expect(() => ObjectQLCapabilitiesSchema.parse(capabilities)).not.toThrow();
  });

  it('should accept minimal ObjectQL capabilities', () => {
    const capabilities: ObjectQLCapabilities = {
      queryFilters: false,
      queryAggregations: false,
      querySorting: false,
      queryPagination: false,
      queryWindowFunctions: false,
      querySubqueries: false,
      queryDistinct: false,
      queryHaving: false,
      queryJoins: false,
      fullTextSearch: false,
      vectorSearch: false,
      geoSpatial: false,
      jsonFields: false,
      arrayFields: false,
      validationRules: false,
      workflows: false,
      triggers: false,
      formulas: false,
      transactions: false,
      bulkOperations: false,
    };

    expect(() => ObjectQLCapabilitiesSchema.parse(capabilities)).not.toThrow();
  });

  it('should use default values for boolean fields', () => {
    const result = ObjectQLCapabilitiesSchema.parse({});

    expect(result.queryFilters).toBe(true);
    expect(result.queryAggregations).toBe(true);
    expect(result.querySorting).toBe(true);
    expect(result.queryPagination).toBe(true);
    expect(result.queryWindowFunctions).toBe(false);
    expect(result.vectorSearch).toBe(false);
  });

  it('should accept optional supportedDrivers array', () => {
    const withDrivers = ObjectQLCapabilitiesSchema.parse({
      supportedDrivers: ['postgresql', 'sqlite', 'excel'],
    });

    expect(withDrivers.supportedDrivers).toEqual(['postgresql', 'sqlite', 'excel']);

    const withoutDrivers = ObjectQLCapabilitiesSchema.parse({});
    expect(withoutDrivers.supportedDrivers).toBeUndefined();
  });
});

describe('ObjectUICapabilitiesSchema', () => {
  it('should accept valid ObjectUI capabilities with all features enabled', () => {
    const capabilities: ObjectUICapabilities = {
      listView: true,
      formView: true,
      kanbanView: true,
      calendarView: true,
      ganttView: true,
      dashboards: true,
      reports: true,
      charts: true,
      customPages: true,
      customThemes: true,
      customComponents: true,
      customActions: true,
      screenFlows: true,
      mobileOptimized: true,
      accessibility: true,
    };

    expect(() => ObjectUICapabilitiesSchema.parse(capabilities)).not.toThrow();
  });

  it('should accept minimal ObjectUI capabilities', () => {
    const capabilities: ObjectUICapabilities = {
      listView: false,
      formView: false,
      kanbanView: false,
      calendarView: false,
      ganttView: false,
      dashboards: false,
      reports: false,
      charts: false,
      customPages: false,
      customThemes: false,
      customComponents: false,
      customActions: false,
      screenFlows: false,
      mobileOptimized: false,
      accessibility: false,
    };

    expect(() => ObjectUICapabilitiesSchema.parse(capabilities)).not.toThrow();
  });

  it('should use default values for boolean fields', () => {
    const result = ObjectUICapabilitiesSchema.parse({});

    expect(result.listView).toBe(true);
    expect(result.formView).toBe(true);
    expect(result.dashboards).toBe(true);
    expect(result.kanbanView).toBe(false);
    expect(result.customThemes).toBe(false);
  });
});

describe('ObjectOSCapabilitiesSchema', () => {
  it('should accept valid ObjectOS capabilities with all features enabled', () => {
    const capabilities: ObjectOSCapabilities = {
      version: '1.0.0',
      environment: 'production',
      restApi: true,
      graphqlApi: true,
      odataApi: true,
      websockets: true,
      serverSentEvents: true,
      eventBus: true,
      webhooks: true,
      apiContracts: true,
      authentication: true,
      rbac: true,
      fieldLevelSecurity: true,
      rowLevelSecurity: true,
      multiTenant: true,
      backgroundJobs: true,
      auditLogging: true,
      fileStorage: true,
      i18n: true,
      pluginSystem: true,
      features: [],
      apis: [],
      systemObjects: ['user', 'role', 'permission'],
      limits: {
        maxObjects: 1000,
        maxFieldsPerObject: 500,
        maxRecordsPerQuery: 10000,
        apiRateLimit: 1000,
        fileUploadSizeLimit: 10485760,
      },
    };

    expect(() => ObjectOSCapabilitiesSchema.parse(capabilities)).not.toThrow();
  });

  it('should require version and environment fields', () => {
    expect(() => ObjectOSCapabilitiesSchema.parse({})).toThrow();

    expect(() =>
      ObjectOSCapabilitiesSchema.parse({
        version: '1.0.0',
      })
    ).toThrow();

    expect(() =>
      ObjectOSCapabilitiesSchema.parse({
        version: '1.0.0',
        environment: 'development',
      })
    ).not.toThrow();
  });

  it('should validate environment enum values', () => {
    expect(() =>
      ObjectOSCapabilitiesSchema.parse({
        version: '1.0.0',
        environment: 'invalid',
      })
    ).toThrow();

    const validEnvironments = ['development', 'test', 'staging', 'production'];
    validEnvironments.forEach((env) => {
      expect(() =>
        ObjectOSCapabilitiesSchema.parse({
          version: '1.0.0',
          environment: env,
        })
      ).not.toThrow();
    });
  });

  it('should use default values for boolean fields', () => {
    const result = ObjectOSCapabilitiesSchema.parse({
      version: '1.0.0',
      environment: 'development',
    });

    expect(result.restApi).toBe(true);
    expect(result.authentication).toBe(true);
    expect(result.fileStorage).toBe(true);
    expect(result.graphqlApi).toBe(false);
    expect(result.multiTenant).toBe(false);
  });

  it('should accept optional limits object', () => {
    const withLimits = ObjectOSCapabilitiesSchema.parse({
      version: '1.0.0',
      environment: 'production',
      limits: {
        maxObjects: 500,
        apiRateLimit: 100,
      },
    });

    expect(withLimits.limits?.maxObjects).toBe(500);
    expect(withLimits.limits?.apiRateLimit).toBe(100);

    const withoutLimits = ObjectOSCapabilitiesSchema.parse({
      version: '1.0.0',
      environment: 'development',
    });

    expect(withoutLimits.limits).toBeUndefined();
  });
});

describe('ObjectStackCapabilitiesSchema', () => {
  it('should accept complete ObjectStack capabilities with all subsystems', () => {
    const capabilities: ObjectStackCapabilities = {
      data: {
        queryFilters: true,
        queryAggregations: true,
        querySorting: true,
        queryPagination: true,
        queryWindowFunctions: true,
        querySubqueries: true,
        queryDistinct: true,
        queryHaving: true,
        queryJoins: true,
        fullTextSearch: true,
        vectorSearch: true,
        geoSpatial: true,
        jsonFields: true,
        arrayFields: true,
        validationRules: true,
        workflows: true,
        triggers: true,
        formulas: true,
        transactions: true,
        bulkOperations: true,
        supportedDrivers: ['postgresql', 'mongodb'],
      },
      ui: {
        listView: true,
        formView: true,
        kanbanView: true,
        calendarView: true,
        ganttView: false,
        dashboards: true,
        reports: true,
        charts: true,
        customPages: true,
        customThemes: false,
        customComponents: false,
        customActions: true,
        screenFlows: true,
        mobileOptimized: true,
        accessibility: false,
      },
      system: {
        version: '1.0.0',
        environment: 'production',
        restApi: true,
        graphqlApi: true,
        odataApi: false,
        websockets: true,
        serverSentEvents: false,
        eventBus: true,
        webhooks: true,
        apiContracts: false,
        authentication: true,
        rbac: true,
        fieldLevelSecurity: true,
        rowLevelSecurity: true,
        multiTenant: true,
        backgroundJobs: true,
        auditLogging: true,
        fileStorage: true,
        i18n: true,
        pluginSystem: false,
        systemObjects: ['user', 'role', 'permission', 'object'],
        limits: {
          maxObjects: 1000,
          maxFieldsPerObject: 500,
          apiRateLimit: 1000,
        },
      },
    };

    expect(() => ObjectStackCapabilitiesSchema.parse(capabilities)).not.toThrow();
  });

  it('should require all three subsystem capability objects', () => {
    expect(() => ObjectStackCapabilitiesSchema.parse({})).toThrow();

    expect(() =>
      ObjectStackCapabilitiesSchema.parse({
        data: {},
        ui: {},
      })
    ).toThrow();

    expect(() =>
      ObjectStackCapabilitiesSchema.parse({
        data: {},
        ui: {},
        system: {
          version: '1.0.0',
          environment: 'development',
        },
      })
    ).not.toThrow();
  });

  it('should allow minimal valid configuration', () => {
    const minimal: ObjectStackCapabilities = {
      data: {},
      ui: {},
      system: {
        version: '0.1.0',
        environment: 'development',
      },
    };

    const result = ObjectStackCapabilitiesSchema.parse(minimal);

    // Check that defaults are applied
    expect(result.data.queryFilters).toBe(true);
    expect(result.ui.listView).toBe(true);
    expect(result.system.restApi).toBe(true);
  });

  it('should preserve subsystem-specific optional fields', () => {
    const capabilities = ObjectStackCapabilitiesSchema.parse({
      data: {
        supportedDrivers: ['postgresql', 'sqlite'],
      },
      ui: {},
      system: {
        version: '1.0.0',
        environment: 'production',
        systemObjects: ['user', 'role'],
        limits: {
          maxObjects: 100,
        },
      },
    });

    expect(capabilities.data.supportedDrivers).toEqual(['postgresql', 'sqlite']);
    expect(capabilities.system.systemObjects).toEqual(['user', 'role']);
    expect(capabilities.system.limits?.maxObjects).toBe(100);
  });
});

describe('ObjectStackDefinitionSchema', () => {
  it('should accept a complete ObjectStack definition', () => {
    const definition = {
      manifest: {
        id: 'com.example.test',
        name: 'test-project',
        version: '1.0.0',
        type: 'app',
        description: 'A test project',
      },
      objects: [],
      apps: [],
    };

    expect(() => ObjectStackDefinitionSchema.parse(definition)).not.toThrow();
  });

  it('should accept definition without manifest (manifest is optional)', () => {
    expect(() => ObjectStackDefinitionSchema.parse({})).not.toThrow();
  });
});

describe('defineStack', () => {
  const baseManifest = {
    id: 'com.example.test',
    name: 'test-project',
    version: '1.0.0',
    type: 'app' as const,
  };

  it('should validate config in default mode (strict by default)', () => {
    const config = { manifest: baseManifest, objects: [] };
    const result = defineStack(config);
    // Default is now strict=true, so result is validated and is a different object reference
    expect(result).not.toBe(config);  // Validation creates new object
    expect(result).toEqual(config);   // But content is the same
    expect(result.manifest).toBeDefined();
  });

  it('should return config as-is when strict is false', () => {
    const config = { manifest: baseManifest };
    const result = defineStack(config, { strict: false });
    expect(result).toStrictEqual(config);  // When strict=false, content should be equivalent
  });

  it('should parse and validate in strict mode', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', fields: { title: { type: 'text' } } },
      ],
    };
    expect(() => defineStack(config, { strict: true })).not.toThrow();
  });

  it('should throw on invalid manifest in strict mode', () => {
    const config = { manifest: {} };
    expect(() => defineStack(config as any, { strict: true })).toThrow('defineStack validation failed');
  });

  it('should detect workflow referencing undefined object in strict mode', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', fields: { title: { type: 'text' } } },
      ],
      workflows: [
        { name: 'update_status', objectName: 'nonexistent', triggerType: 'on_create' },
      ],
    };
    expect(() => defineStack(config, { strict: true })).toThrow('nonexistent');
    expect(() => defineStack(config, { strict: true })).toThrow('cross-reference validation failed');
  });

  it('should detect approval referencing undefined object in strict mode', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'deal', fields: { amount: { type: 'number' } } },
      ],
      approvals: [
        {
          name: 'deal_approval',
          label: 'Deal Approval',
          object: 'missing_object',
          steps: [{ name: 'step1', label: 'Step 1', approvers: [{ type: 'manager', value: 'mgr' }] }],
        },
      ],
    };
    expect(() => defineStack(config, { strict: true })).toThrow('missing_object');
  });

  it('should detect hook referencing undefined object in strict mode', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'contact', fields: { email: { type: 'email' } } },
      ],
      hooks: [
        { name: 'enrich', object: 'ghost_object', events: ['beforeInsert'] },
      ],
    };
    expect(() => defineStack(config, { strict: true })).toThrow('ghost_object');
  });

  it('should pass strict mode when all references are valid', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'lead', fields: { status: { type: 'text' } } },
      ],
      workflows: [
        { name: 'qualify_lead', objectName: 'lead', triggerType: 'on_create' },
      ],
      hooks: [
        { name: 'enrich_lead', object: 'lead', events: ['beforeInsert'] },
      ],
    };
    expect(() => defineStack(config, { strict: true })).not.toThrow();
  });

  it('should skip cross-reference validation when no objects are defined', () => {
    const config = {
      manifest: baseManifest,
      workflows: [
        { name: 'some_workflow', objectName: 'external_object', triggerType: 'on_create' },
      ],
    };
    // No objects defined, so cross-ref validation is skipped
    expect(() => defineStack(config, { strict: true })).not.toThrow();
  });

  it('should accept config without manifest (manifest is optional)', () => {
    const config = {
      objects: [
        { name: 'task', fields: { title: { type: 'text' } } },
      ],
    };
    const result = defineStack(config as any);
    expect(result.manifest).toBeUndefined();
    expect(result.objects).toHaveLength(1);
  });
});

describe('defineStack - Field Name Validation', () => {
  const baseManifest = {
    id: 'com.example.test',
    name: 'test-field-validation',
    version: '1.0.0',
    type: 'app' as const,
  };

  it('should reject camelCase field names in strict mode (default)', () => {
    const config = {
      manifest: baseManifest,
      objects: [{
        name: 'test_object',
        fields: {
          firstName: { type: 'text' as const }  // Invalid: camelCase
        }
      }]
    };

    expect(() => defineStack(config)).toThrow(/Invalid key in record|Field names must be lowercase snake_case/);
  });

  it('should reject PascalCase field names in strict mode (default)', () => {
    const config = {
      manifest: baseManifest,
      objects: [{
        name: 'test_object',
        fields: {
          FirstName: { type: 'text' as const }  // Invalid: PascalCase
        }
      }]
    };

    expect(() => defineStack(config)).toThrow(/Invalid key in record|Field names must be lowercase snake_case/);
  });

  it('should accept snake_case field names', () => {
    const config = {
      manifest: baseManifest,
      objects: [{
        name: 'test_object',
        fields: {
          first_name: { type: 'text' as const },  // Valid
          last_name: { type: 'text' as const },   // Valid
        }
      }]
    };

    expect(() => defineStack(config)).not.toThrow();
  });

  it('should bypass validation when strict is false', () => {
    const config = {
      manifest: baseManifest,
      objects: [{
        name: 'test_object',
        fields: {
          firstName: { type: 'text' as const }  // Invalid, but allowed in non-strict mode
        }
      }]
    };

    expect(() => defineStack(config, { strict: false })).not.toThrow();
  });
});

describe('defineStack - Map Format Support', () => {
  const baseManifest = {
    id: 'com.example.test',
    name: 'test-map-format',
    version: '1.0.0',
    type: 'app' as const,
  };

  it('should accept objects in map format', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        task: { fields: { title: { type: 'text' } } },
        project: { fields: { name: { type: 'text' } } },
      },
    };

    const result = defineStack(config);
    expect(result.objects).toHaveLength(2);
    expect(result.objects![0].name).toBe('task');
    expect(result.objects![1].name).toBe('project');
  });

  it('should accept apps in map format', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      apps: {
        sales: {
          label: 'Sales',
          objects: ['account', 'contact'],
        },
      },
    };

    const result = defineStack(config);
    expect(result.apps).toHaveLength(1);
    expect(result.apps![0].name).toBe('sales');
    expect(result.apps![0].label).toBe('Sales');
  });

  it('should accept mixed array and map formats in the same call', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        task: { fields: { title: { type: 'text' } } },
      },
      apps: [
        { name: 'sales', label: 'Sales', objects: ['account'] },
      ],
    };

    const result = defineStack(config);
    expect(result.objects).toHaveLength(1);
    expect(result.objects![0].name).toBe('task');
    expect(result.apps).toHaveLength(1);
    expect(result.apps![0].name).toBe('sales');
  });

  it('should preserve explicit name in value over map key', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        my_key: { name: 'actual_object', fields: { title: { type: 'text' } } },
      },
    };

    const result = defineStack(config);
    expect(result.objects![0].name).toBe('actual_object');
  });

  it('should work with empty map', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {},
    };

    const result = defineStack(config);
    expect(result.objects).toEqual([]);
  });

  it('should validate cross-references with map-formatted objects', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        task: { fields: { title: { type: 'text' } } },
      },
      workflows: {
        update_status: { objectName: 'task', triggerType: 'on_create' },
      },
    };

    // Valid reference — should not throw
    expect(() => defineStack(config, { strict: true })).not.toThrow();
  });

  it('should detect invalid cross-references with map-formatted inputs', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        task: { fields: { title: { type: 'text' } } },
      },
      workflows: {
        bad_workflow: { objectName: 'nonexistent', triggerType: 'on_create' },
      },
    };

    expect(() => defineStack(config, { strict: true })).toThrow('nonexistent');
    expect(() => defineStack(config, { strict: true })).toThrow('cross-reference validation failed');
  });

  it('should support map format for actions', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      actions: {
        approve_deal: {
          label: 'Approve Deal',
          type: 'script',
        },
      },
    };

    const result = defineStack(config);
    expect(result.actions).toHaveLength(1);
    expect(result.actions![0].name).toBe('approve_deal');
    expect(result.actions![0].label).toBe('Approve Deal');
  });

  it('should support map format for pages', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      pages: {
        landing: {
          label: 'Landing Page',
          type: 'app',
          route: '/landing',
          regions: [
            { name: 'main', components: [{ type: 'page:section', properties: {} }] },
          ],
        },
      },
    };

    const result = defineStack(config);
    expect(result.pages).toHaveLength(1);
    expect(result.pages![0].name).toBe('landing');
  });

  it('should support map format for dashboards', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      dashboards: {
        sales_overview: {
          label: 'Sales Overview',
          widgets: [],
        },
      },
    };

    const result = defineStack(config);
    expect(result.dashboards).toHaveLength(1);
    expect(result.dashboards![0].name).toBe('sales_overview');
  });

  it('should support map format for roles', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      roles: {
        admin: { label: 'Administrator' },
        user: { label: 'Standard User' },
      },
    };

    const result = defineStack(config);
    expect(result.roles).toHaveLength(2);
    expect(result.roles![0].name).toBe('admin');
    expect(result.roles![1].name).toBe('user');
  });

  it('should support map format for hooks', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        contact: { fields: { email: { type: 'email' } } },
      },
      hooks: {
        enrich_contact: {
          object: 'contact',
          events: ['beforeInsert'],
        },
      },
    };

    const result = defineStack(config, { strict: true });
    expect(result.hooks).toHaveLength(1);
    expect(result.hooks![0].name).toBe('enrich_contact');
    expect(result.hooks![0].object).toBe('contact');
  });

  it('should work with non-strict mode and map format', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        task: { fields: { title: { type: 'text' } } },
      },
    };

    const result = defineStack(config, { strict: false });
    // Even in non-strict mode, normalization should apply
    expect(Array.isArray(result.objects)).toBe(true);
    expect(result.objects![0].name).toBe('task');
  });

  it('should reject invalid object names from map keys in strict mode', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      objects: {
        InvalidName: { fields: { title: { type: 'text' } } },
      },
    };

    // The key 'InvalidName' becomes name, which fails snake_case validation
    expect(() => defineStack(config, { strict: true })).toThrow();
  });

  it('should not affect views (ViewSchema has no name field)', () => {
    const config: ObjectStackDefinitionInput = {
      manifest: baseManifest,
      views: [
        {
          list: {
            type: 'grid',
            columns: ['title', 'status'],
          },
        },
      ],
    };

    const result = defineStack(config);
    expect(result.views).toHaveLength(1);
    expect(result.views![0].list?.type).toBe('grid');
  });
});

// ============================================================================
// Negative / Inverse Validation Tests — Cross-Reference
// ============================================================================

describe('defineStack - Seed Data Cross-Reference Validation', () => {
  const baseManifest = {
    id: 'com.example.test',
    name: 'test-project',
    version: '1.0.0',
    type: 'app' as const,
  };

  it('should detect seed data referencing undefined object', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'account', fields: { name: { type: 'text' } } },
      ],
      data: [
        { object: 'ghost_object', records: [{ name: 'Test' }] },
      ],
    };
    expect(() => defineStack(config)).toThrow('ghost_object');
    expect(() => defineStack(config)).toThrow('cross-reference validation failed');
  });

  it('should pass when seed data references defined object', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'account', fields: { name: { type: 'text' } } },
      ],
      data: [
        { object: 'account', records: [{ name: 'Acme Corp' }] },
      ],
    };
    expect(() => defineStack(config)).not.toThrow();
  });
});

describe('defineStack - Navigation Cross-Reference Validation', () => {
  const baseManifest = {
    id: 'com.example.test',
    name: 'test-project',
    version: '1.0.0',
    type: 'app' as const,
  };

  it('should detect navigation referencing undefined object', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', fields: { title: { type: 'text' } } },
      ],
      apps: [
        {
          name: 'my_app',
          label: 'My App',
          navigation: [
            { id: 'nav_missing', type: 'object' as const, label: 'Missing', objectName: 'nonexistent_object' },
          ],
        },
      ],
    };
    expect(() => defineStack(config)).toThrow('nonexistent_object');
  });

  it('should detect navigation referencing undefined dashboard', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', fields: { title: { type: 'text' } } },
      ],
      dashboards: [
        { name: 'sales_dashboard', label: 'Sales', widgets: [] },
      ],
      apps: [
        {
          name: 'my_app',
          label: 'My App',
          navigation: [
            { id: 'nav_ghost', type: 'dashboard' as const, label: 'Missing', dashboardName: 'ghost_dashboard' },
          ],
        },
      ],
    };
    expect(() => defineStack(config)).toThrow('ghost_dashboard');
  });

  it('should pass when all navigation references are valid', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', fields: { title: { type: 'text' } } },
      ],
      dashboards: [
        { name: 'task_overview', label: 'Overview', widgets: [] },
      ],
      apps: [
        {
          name: 'my_app',
          label: 'My App',
          navigation: [
            { id: 'nav_tasks', type: 'object' as const, label: 'Tasks', objectName: 'task' },
            { id: 'nav_overview', type: 'dashboard' as const, label: 'Overview', dashboardName: 'task_overview' },
          ],
        },
      ],
    };
    expect(() => defineStack(config)).not.toThrow();
  });
});

// ============================================================================
// Action Cross-Reference Validation — ensures action targets resolve
// ============================================================================

describe('defineStack - Action Cross-Reference Validation', () => {
  const baseManifest = {
    id: 'com.example.test',
    name: 'test-project',
    version: '1.0.0',
    type: 'app' as const,
  };

  it('should detect action referencing undefined flow', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', label: 'Task', fields: { title: { type: 'text' as const } } },
      ],
      flows: [
        { name: 'existing_flow', label: 'Existing Flow', type: 'autolaunched' as const, nodes: [], edges: [] },
      ],
      actions: [
        { name: 'run_flow', label: 'Run Flow', type: 'flow' as const, target: 'nonexistent_flow' },
      ],
    };

    expect(() => defineStack(config)).toThrow('cross-reference validation failed');
    expect(() => defineStack(config)).toThrow('nonexistent_flow');
  });

  it('should pass when action references a defined flow', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', label: 'Task', fields: { title: { type: 'text' as const } } },
      ],
      flows: [
        { name: 'approval_flow', label: 'Approval Flow', type: 'autolaunched' as const, nodes: [], edges: [] },
      ],
      actions: [
        { name: 'run_approval', label: 'Run Approval', type: 'flow' as const, target: 'approval_flow' },
      ],
    };

    expect(() => defineStack(config)).not.toThrow();
  });

  it('should skip action flow validation when no flows are defined', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', label: 'Task', fields: { title: { type: 'text' as const } } },
      ],
      actions: [
        { name: 'run_flow', label: 'Run Flow', type: 'flow' as const, target: 'some_flow' },
      ],
    };

    expect(() => defineStack(config)).not.toThrow();
  });

  it('should accept script actions without cross-reference validation', () => {
    const config = {
      manifest: baseManifest,
      objects: [
        { name: 'task', label: 'Task', fields: { title: { type: 'text' as const } } },
      ],
      actions: [
        { name: 'approve_task', label: 'Approve', type: 'script' as const, target: 'approveTask' },
      ],
    };

    expect(() => defineStack(config)).not.toThrow();
  });
});

// ============================================================================
// Example-Level Strict Validation — mirrors examples/app-todo & examples/app-crm
// ============================================================================

describe('defineStack - Example-Level Strict Validation', () => {
  it('should validate a Todo-style app config (strict mode)', () => {
    const todoConfig = {
      manifest: {
        id: 'com.example.todo',
        namespace: 'todo',
        version: '2.0.0',
        type: 'app' as const,
        name: 'Todo Manager',
        description: 'A comprehensive Todo app',
      },
      objects: [
        {
          name: 'task',
          label: 'Task',
          fields: {
            subject: { type: 'text', label: 'Subject', required: true },
            status: { type: 'select', label: 'Status', options: [
              { value: 'not_started', label: 'Not Started' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
            ]},
            priority: { type: 'select', label: 'Priority', options: [
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]},
            category: { type: 'text', label: 'Category' },
            due_date: { type: 'date', label: 'Due Date' },
          },
        },
      ],
      data: [
        {
          object: 'task',
          mode: 'upsert' as const,
          externalId: 'subject',
          records: [
            { subject: 'Learn ObjectStack', status: 'completed', priority: 'high', category: 'Work' },
            { subject: 'Build a cool app', status: 'in_progress', priority: 'normal', category: 'Work' },
          ],
        },
      ],
      dashboards: [
        {
          name: 'task_overview',
          label: 'Task Overview',
          widgets: [
            { id: 'total_tasks', title: 'Total Tasks', type: 'metric', object: 'task', aggregate: 'count', layout: { x: 0, y: 0, w: 3, h: 2 } },
            { id: 'by_status', title: 'By Status', type: 'pie', object: 'task', categoryField: 'status', aggregate: 'count', layout: { x: 3, y: 0, w: 6, h: 4 } },
          ],
        },
      ],
      apps: [
        {
          name: 'todo_app',
          label: 'Todo Manager',
          navigation: [
            { id: 'nav_tasks', type: 'object' as const, label: 'Tasks', objectName: 'task' },
            { id: 'nav_dashboard', type: 'dashboard' as const, label: 'Overview', dashboardName: 'task_overview' },
          ],
        },
      ],
    };
    expect(() => defineStack(todoConfig, { strict: true })).not.toThrow();
  });

  it('should validate a CRM-style app config with seed data and reports (strict mode)', () => {
    const crmConfig = {
      manifest: {
        id: 'com.example.crm',
        namespace: 'crm',
        version: '1.0.0',
        type: 'app' as const,
        name: 'Sales CRM',
        description: 'Complete sales management solution',
      },
      objects: [
        {
          name: 'account',
          label: 'Account',
          fields: {
            name: { type: 'text', label: 'Name', required: true },
            industry: { type: 'text', label: 'Industry' },
            annual_revenue: { type: 'number', label: 'Annual Revenue' },
          },
        },
        {
          name: 'opportunity',
          label: 'Opportunity',
          fields: {
            name: { type: 'text', label: 'Name', required: true },
            amount: { type: 'currency', label: 'Amount' },
            stage: { type: 'select', label: 'Stage', options: [
              { value: 'prospecting', label: 'Prospecting' },
              { value: 'negotiation', label: 'Negotiation' },
              { value: 'closed_won', label: 'Closed Won' },
            ]},
          },
        },
      ],
      data: [
        {
          object: 'account',
          mode: 'upsert' as const,
          externalId: 'name',
          records: [
            { name: 'Acme Corp', industry: 'technology', annual_revenue: 5000000 },
          ],
        },
      ],
      reports: [
        {
          name: 'pipeline_report',
          label: 'Pipeline Report',
          objectName: 'opportunity',
          type: 'summary' as const,
          columns: [
            { field: 'name' },
            { field: 'amount', aggregate: 'sum' as const },
          ],
          groupingsDown: [{ field: 'stage' }],
        },
      ],
      dashboards: [
        {
          name: 'sales_overview',
          label: 'Sales Overview',
          widgets: [
            { id: 'pipeline_value', title: 'Pipeline Value', type: 'metric', object: 'opportunity', valueField: 'amount', aggregate: 'sum', layout: { x: 0, y: 0, w: 4, h: 2 } },
          ],
        },
      ],
      apps: [
        {
          name: 'sales_crm',
          label: 'Sales CRM',
          icon: 'briefcase',
          navigation: [
            { id: 'nav_accounts', type: 'object' as const, label: 'Accounts', objectName: 'account' },
            { id: 'nav_opportunities', type: 'object' as const, label: 'Opportunities', objectName: 'opportunity' },
            { id: 'nav_dashboard', type: 'dashboard' as const, label: 'Sales Overview', dashboardName: 'sales_overview' },
            { id: 'nav_report', type: 'report' as const, label: 'Pipeline', reportName: 'pipeline_report' },
          ],
        },
      ],
    };
    expect(() => defineStack(crmConfig, { strict: true })).not.toThrow();
  });

  it('should reject CRM config with seed data referencing non-existent object', () => {
    const badConfig = {
      manifest: {
        id: 'com.example.crm',
        name: 'crm',
        version: '1.0.0',
        type: 'app' as const,
      },
      objects: [
        { name: 'account', fields: { name: { type: 'text' } } },
      ],
      data: [
        { object: 'contact', records: [{ name: 'John' }] },
      ],
    };
    expect(() => defineStack(badConfig, { strict: true })).toThrow('contact');
  });
});
