// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { QueryAST, HookContext, ServiceObject } from '@objectstack/spec/data';
import { 
  EngineQueryOptions,
  DataEngineInsertOptions, 
  EngineUpdateOptions, 
  EngineDeleteOptions,
  EngineAggregateOptions,
  EngineCountOptions 
} from '@objectstack/spec/data';
import { ExecutionContext, ExecutionContextSchema } from '@objectstack/spec/kernel';
import { DriverInterface, IDataEngine, Logger, createLogger } from '@objectstack/core';
import { CoreServiceName } from '@objectstack/spec/system';
import { SchemaRegistry } from './registry.js';

export type HookHandler = (context: HookContext) => Promise<void> | void;

/**
 * Per-object hook entry with priority support
 */
export interface HookEntry {
  handler: HookHandler;
  object?: string | string[];  // undefined = global hook
  priority: number;
  packageId?: string;
}

/**
 * Operation Context for Middleware Chain
 */
export interface OperationContext {
  object: string;
  operation: 'find' | 'findOne' | 'insert' | 'update' | 'delete' | 'count' | 'aggregate';
  ast?: QueryAST;
  data?: any;
  options?: any;
  context?: ExecutionContext;
  result?: any;
}

/**
 * Engine Middleware (Onion model)
 */
export type EngineMiddleware = (
  ctx: OperationContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Host Context provided to plugins (Internal ObjectQL Plugin System)
 */
export interface ObjectQLHostContext {
  ql: ObjectQL;
  logger: Logger;
  // Extensible map for host-specific globals (like HTTP Router, etc.)
  [key: string]: any;
}

/**
 * ObjectQL Engine
 * 
 * Implements the IDataEngine interface for data persistence.
 * Acts as the reference implementation for:
 * - CoreServiceName.data (CRUD)
 * - CoreServiceName.metadata (Schema Registry)
 */
export class ObjectQL implements IDataEngine {
  private drivers = new Map<string, DriverInterface>();
  private defaultDriver: string | null = null;
  private logger: Logger;
  
  // Per-object hooks with priority support
  private hooks: Map<string, HookEntry[]> = new Map([
    ['beforeFind', []], ['afterFind', []],
    ['beforeInsert', []], ['afterInsert', []],
    ['beforeUpdate', []], ['afterUpdate', []],
    ['beforeDelete', []], ['afterDelete', []],
  ]);

  // Middleware chain (onion model)
  private middlewares: Array<{
    fn: EngineMiddleware;
    object?: string;
  }> = [];

  // Action registry: key = "objectName:actionName"
  private actions = new Map<string, { handler: (ctx: any) => Promise<any> | any; package?: string }>();
  
  // Host provided context additions (e.g. Server router)
  private hostContext: Record<string, any> = {};

  constructor(hostContext: Record<string, any> = {}) {
    this.hostContext = hostContext;
    // Use provided logger or create a new one
    this.logger = hostContext.logger || createLogger({ level: 'info', format: 'pretty' });
    this.logger.info('ObjectQL Engine Instance Created');
  }

  /**
   * Service Status Report
   * Used by Kernel to verify health and capabilities.
   */
  getStatus() {
      return {
          name: CoreServiceName.enum.data,
          status: 'running',
          version: '0.9.0',
          features: ['crud', 'query', 'aggregate', 'transactions', 'metadata']
      };
  }

  /**
   * Expose the SchemaRegistry for plugins to register metadata
   */
  get registry() {
    return SchemaRegistry;
  }

  /**
   * Load and Register a Plugin
   */
  async use(manifestPart: any, runtimePart?: any) {
    this.logger.debug('Loading plugin', { 
      hasManifest: !!manifestPart, 
      hasRuntime: !!runtimePart 
    });

    // 1. Validate / Register Manifest
    if (manifestPart) {
      this.registerApp(manifestPart);
    }

    // 2. Execute Runtime
    if (runtimePart) {
       const pluginDef = (runtimePart as any).default || runtimePart;
       if (pluginDef.onEnable) {
          this.logger.debug('Executing plugin runtime onEnable');
          
          const context: ObjectQLHostContext = {
            ql: this,
            logger: this.logger,
            // Expose the driver registry helper explicitly if needed
            drivers: {
                register: (driver: DriverInterface) => this.registerDriver(driver)
            },
            ...this.hostContext
          };
          
          await pluginDef.onEnable(context);
          this.logger.debug('Plugin runtime onEnable completed');
       }
    }
  }

  /**
   * Register a hook
   * @param event The event name (e.g. 'beforeFind', 'afterInsert')
   * @param handler The handler function
   * @param options Optional: target object(s) and priority
   */
  registerHook(event: string, handler: HookHandler, options?: {
    object?: string | string[];
    priority?: number;
    packageId?: string;
  }) {
    if (!this.hooks.has(event)) {
        this.hooks.set(event, []);
    }
    const entries = this.hooks.get(event)!;
    entries.push({
      handler,
      object: options?.object,
      priority: options?.priority ?? 100,
      packageId: options?.packageId,
    });
    // Sort by priority (lower runs first)
    entries.sort((a, b) => a.priority - b.priority);
    this.logger.debug('Registered hook', { event, object: options?.object, priority: options?.priority ?? 100, totalHandlers: entries.length });
  }

  public async triggerHooks(event: string, context: HookContext) {
    const entries = this.hooks.get(event) || [];
    
    if (entries.length === 0) {
      this.logger.debug('No hooks registered for event', { event });
      return;
    }

    this.logger.debug('Triggering hooks', { event, count: entries.length });
    
    for (const entry of entries) {
      // Per-object matching
      if (entry.object) {
        const targets = Array.isArray(entry.object) ? entry.object : [entry.object];
        if (!targets.includes('*') && !targets.includes(context.object)) {
          continue; // Skip non-matching hooks
        }
      }
      await entry.handler(context);
    }
  }

  // ========================================
  // Action System
  // ========================================

  /**
   * Register a named action on an object.
   * Actions are custom business logic callable via `repo.execute(actionName, params)`.
   *
   * @param objectName Target object
   * @param actionName Unique action name within the object
   * @param handler Handler function
   * @param packageName Optional package owner (for cleanup)
   */
  registerAction(objectName: string, actionName: string, handler: (ctx: any) => Promise<any> | any, packageName?: string): void {
    const key = `${objectName}:${actionName}`;
    this.actions.set(key, { handler, package: packageName });
    this.logger.debug('Registered action', { objectName, actionName, package: packageName });
  }

  /**
   * Execute a named action on an object.
   */
  async executeAction(objectName: string, actionName: string, ctx: any): Promise<any> {
    const entry = this.actions.get(`${objectName}:${actionName}`);
    if (!entry) {
      throw new Error(`Action '${actionName}' on object '${objectName}' not found`);
    }
    return entry.handler(ctx);
  }

  /**
   * Remove all actions registered by a specific package.
   */
  removeActionsByPackage(packageName: string): void {
    for (const [key, entry] of this.actions.entries()) {
      if (entry.package === packageName) {
        this.actions.delete(key);
      }
    }
  }

  /**
   * Register a middleware function
   * Middlewares execute in onion model around every data operation.
   * @param fn The middleware function
   * @param options Optional: target object filter
   */
  registerMiddleware(fn: EngineMiddleware, options?: { object?: string }): void {
    this.middlewares.push({ fn, object: options?.object });
    this.logger.debug('Registered middleware', { object: options?.object, total: this.middlewares.length });
  }

  /**
   * Execute an operation through the middleware chain
   */
  private async executeWithMiddleware(ctx: OperationContext, executor: () => Promise<any>): Promise<any> {
    const applicable = this.middlewares.filter(m =>
      !m.object || m.object === '*' || m.object === ctx.object
    );

    let index = 0;
    const next = async (): Promise<void> => {
      if (index < applicable.length) {
        const mw = applicable[index++];
        await mw.fn(ctx, next);
      } else {
        ctx.result = await executor();
      }
    };

    await next();
    return ctx.result;
  }

  /**
   * Build a HookContext.session from ExecutionContext
   */
  private buildSession(execCtx?: ExecutionContext): HookContext['session'] {
    if (!execCtx) return undefined;
    return {
      userId: execCtx.userId,
      tenantId: execCtx.tenantId,
      roles: execCtx.roles,
      accessToken: execCtx.accessToken,
    };
  }

  /**
   * Register contribution (Manifest)
   * 
   * Installs the manifest as a Package (the unit of installation),
   * then decomposes it into individual metadata items (objects, apps, actions, etc.)
   * and registers each into the SchemaRegistry.
   * 
   * Key: Package ≠ App. The manifest is the package. The apps[] array inside
   * the manifest contains UI navigation definitions (AppSchema).
   */
  registerApp(manifest: any) {
      const id = manifest.id || manifest.name;
      const namespace = manifest.namespace as string | undefined;
      this.logger.debug('Registering package manifest', { id, namespace });

      // 1. Register the Package (manifest + lifecycle state)
      SchemaRegistry.installPackage(manifest);
      this.logger.debug('Installed Package', { id: manifest.id, name: manifest.name, namespace });

      // 2. Register owned objects
      if (manifest.objects) {
          if (Array.isArray(manifest.objects)) {
             this.logger.debug('Registering objects from manifest (Array)', { id, objectCount: manifest.objects.length });
             for (const objDef of manifest.objects) {
                const fqn = SchemaRegistry.registerObject(objDef, id, namespace, 'own');
                this.logger.debug('Registered Object', { fqn, from: id });
             }
          } else {
             this.logger.debug('Registering objects from manifest (Map)', { id, objectCount: Object.keys(manifest.objects).length });
             for (const [name, objDef] of Object.entries(manifest.objects)) {
                // Ensure name in definition matches key
                (objDef as any).name = name;
                const fqn = SchemaRegistry.registerObject(objDef as any, id, namespace, 'own');
                this.logger.debug('Registered Object', { fqn, from: id });
             }
          }
      }

      // 2b. Register object extensions (fields added to objects owned by other packages)
      if (Array.isArray(manifest.objectExtensions) && manifest.objectExtensions.length > 0) {
          this.logger.debug('Registering object extensions', { id, count: manifest.objectExtensions.length });
          for (const ext of manifest.objectExtensions) {
              const targetFqn = ext.extend;
              const priority = ext.priority ?? 200;
              // Create a partial object definition for the extension
              const extDef = {
                  name: targetFqn, // Use the target FQN as name
                  fields: ext.fields,
                  label: ext.label,
                  pluralLabel: ext.pluralLabel,
                  description: ext.description,
                  validations: ext.validations,
                  indexes: ext.indexes,
              };
              // Register as extension (namespace is undefined since we're targeting by FQN)
              SchemaRegistry.registerObject(extDef as any, id, undefined, 'extend', priority);
              this.logger.debug('Registered Object Extension', { target: targetFqn, priority, from: id });
          }
      }

      // 3. Register apps (UI navigation definitions) as their own metadata type
      if (Array.isArray(manifest.apps) && manifest.apps.length > 0) {
          this.logger.debug('Registering apps from manifest', { id, count: manifest.apps.length });
          for (const app of manifest.apps) {
              const appName = app.name || app.id;
              if (appName) {
                  SchemaRegistry.registerApp(app, id);
                  this.logger.debug('Registered App', { app: appName, from: id });
              }
          }
      }

      // 4. If manifest itself looks like an App (has navigation), also register as app
      //    This handles the case where the manifest IS the app definition (legacy/simple packages)
      if (manifest.name && manifest.navigation && !manifest.apps?.length) {
          SchemaRegistry.registerApp(manifest, id);
          this.logger.debug('Registered manifest-as-app', { app: manifest.name, from: id });
      }

      // 5. Register all other metadata types generically
      const metadataArrayKeys = [
        // UI Protocol
        'actions', 'views', 'pages', 'dashboards', 'reports', 'themes',
        // Automation Protocol
        'flows', 'workflows', 'approvals', 'webhooks',
        // Security Protocol
        'roles', 'permissions', 'profiles', 'sharingRules', 'policies',
        // AI Protocol
        'agents', 'ragPipelines',
        // API Protocol
        'apis',
        // Data Extensions
        'hooks', 'mappings', 'analyticsCubes',
        // Integration Protocol
        'connectors',
      ];
      for (const key of metadataArrayKeys) {
          const items = (manifest as any)[key];
          if (Array.isArray(items) && items.length > 0) {
              this.logger.debug(`Registering ${key} from manifest`, { id, count: items.length });
              for (const item of items) {
                  const itemName = item.name || item.id;
                  if (itemName) {
                      SchemaRegistry.registerItem(key, item, 'name' as any, id);
                  }
              }
          }
      }

      // 6. Register seed data as metadata (keyed by target object name)
      const seedData = (manifest as any).data;
      if (Array.isArray(seedData) && seedData.length > 0) {
          this.logger.debug('Registering seed data datasets', { id, count: seedData.length });
          for (const dataset of seedData) {
              if (dataset.object) {
                  SchemaRegistry.registerItem('data', dataset, 'object' as any, id);
              }
          }
      }

      // 6. Register contributions
       if (manifest.contributes?.kinds) {
          this.logger.debug('Registering kinds from manifest', { id, kindCount: manifest.contributes.kinds.length });
          for (const kind of manifest.contributes.kinds) {
            SchemaRegistry.registerKind(kind);
            this.logger.debug('Registered Kind', { kind: kind.name || kind.type, from: id });
          }
       }

      // 7. Recursively register nested plugins
      if (Array.isArray(manifest.plugins) && manifest.plugins.length > 0) {
          this.logger.debug('Processing nested plugins', { id, count: manifest.plugins.length });
          for (const plugin of manifest.plugins) {
              if (plugin && typeof plugin === 'object') {
                  const pluginName = plugin.name || plugin.id || 'unnamed-plugin';
                  this.logger.debug('Registering nested plugin', { pluginName, parentId: id });
                  this.registerPlugin(plugin, id, namespace);
              }
          }
      }
  }

  /**
   * Register a nested plugin's metadata (objects, actions, views, etc.)
   *
   * Unlike registerApp(), this does NOT call SchemaRegistry.installPackage()
   * because plugins are not formal manifests — they are lightweight config
   * bundles with objects, actions, triggers, and navigation.
   *
   * @param plugin - The plugin config object
   * @param parentId - The parent package ID (for ownership tracking)
   * @param parentNamespace - The parent package's namespace (for FQN resolution)
   */
  private registerPlugin(plugin: any, parentId: string, parentNamespace?: string) {
      const pluginName = plugin.name || plugin.id || 'unnamed';
      const pluginNamespace = plugin.namespace || parentNamespace;

      // Use parentId as the owning package for namespace consistency.
      // The parent package already claimed the namespace — nested plugins
      // contribute objects UNDER the parent's ownership.
      const ownerId = parentId;

      // Register objects (supports both Array and Map formats)
      if (plugin.objects) {
          try {
              if (Array.isArray(plugin.objects)) {
                  this.logger.debug('Registering plugin objects (Array)', { pluginName, count: plugin.objects.length });
                  for (const objDef of plugin.objects) {
                      const fqn = SchemaRegistry.registerObject(objDef, ownerId, pluginNamespace, 'own');
                      this.logger.debug('Registered Object', { fqn, from: pluginName });
                  }
              } else {
                  const entries = Object.entries(plugin.objects);
                  this.logger.debug('Registering plugin objects (Map)', { pluginName, count: entries.length });
                  for (const [name, objDef] of entries) {
                      (objDef as any).name = name;
                      const fqn = SchemaRegistry.registerObject(objDef as any, ownerId, pluginNamespace, 'own');
                      this.logger.debug('Registered Object', { fqn, from: pluginName });
                  }
              }
          } catch (err: any) {
              this.logger.warn('Failed to register plugin objects', { pluginName, error: err.message });
          }
      }

      // Register plugin as app if it has navigation (for sidebar display)
      if (plugin.name && plugin.navigation) {
          try {
              SchemaRegistry.registerApp(plugin, ownerId);
              this.logger.debug('Registered plugin-as-app', { app: plugin.name, from: pluginName });
          } catch (err: any) {
              this.logger.warn('Failed to register plugin as app', { pluginName, error: err.message });
          }
      }

      // Register metadata arrays (actions, views, triggers, etc.)
      const metadataArrayKeys = [
          'actions', 'views', 'pages', 'dashboards', 'reports', 'themes',
          'flows', 'workflows', 'approvals', 'webhooks',
          'roles', 'permissions', 'profiles', 'sharingRules', 'policies',
          'agents', 'ragPipelines', 'apis',
          'hooks', 'mappings', 'analyticsCubes', 'connectors',
      ];
      for (const key of metadataArrayKeys) {
          const items = (plugin as any)[key];
          if (Array.isArray(items) && items.length > 0) {
              for (const item of items) {
                  const itemName = item.name || item.id;
                  if (itemName) {
                      SchemaRegistry.registerItem(key, item, 'name' as any, ownerId);
                  }
              }
          }
      }
  }

  /**
   * Register a new storage driver
   */
  registerDriver(driver: DriverInterface, isDefault: boolean = false) {
    if (this.drivers.has(driver.name)) {
      this.logger.warn('Driver already registered, skipping', { driverName: driver.name });
      return;
    }

    this.drivers.set(driver.name, driver);
    this.logger.info('Registered driver', { 
      driverName: driver.name, 
      version: driver.version
    });

    if (isDefault || this.drivers.size === 1) {
      this.defaultDriver = driver.name;
      this.logger.info('Set default driver', { driverName: driver.name });
    }
  }

  /**
   * Helper to get object definition
   */
  getSchema(objectName: string): ServiceObject | undefined {
    return SchemaRegistry.getObject(objectName);
  }

  /**
   * Resolve an object name to its Fully Qualified Name (FQN).
   * 
   * Short names like 'task' are resolved to FQN like 'todo__task'
   * via SchemaRegistry lookup. If no match is found, the name is
   * returned as-is (for ad-hoc / unregistered objects).
   * 
   * This ensures that all driver operations use a consistent key
   * regardless of whether the caller uses the short name or FQN.
   */
  private resolveObjectName(name: string): string {
    const schema = SchemaRegistry.getObject(name);
    if (schema) {
      // Prefer the physical table name (e.g., 'sys_user') over the FQN
      // (e.g., 'sys__user'). ObjectSchema.create() auto-derives tableName
      // as {namespace}_{name} which matches the storage convention.
      return schema.tableName || schema.name;
    }
    return name; // Ad-hoc object, keep as-is
  }

  /**
   * Helper to get the target driver
   */
  private getDriver(objectName: string): DriverInterface {
    const object = SchemaRegistry.getObject(objectName);
    
    // 1. If object definition exists, check for explicit datasource
    if (object) {
      const datasourceName = object.datasource || 'default';
      
      // If configured for 'default', try to find the default driver
      if (datasourceName === 'default') {
        if (this.defaultDriver && this.drivers.has(this.defaultDriver)) {
          return this.drivers.get(this.defaultDriver)!;
        }
      } else {
        // Specific datasource requested
        if (this.drivers.has(datasourceName)) {
            return this.drivers.get(datasourceName)!;
        }
        throw new Error(`[ObjectQL] Datasource '${datasourceName}' configured for object '${objectName}' is not registered.`);
      }
    }

    // 2. Fallback for ad-hoc objects or missing definitions
    if (this.defaultDriver) {
      return this.drivers.get(this.defaultDriver)!;
    }

    throw new Error(`[ObjectQL] No driver available for object '${objectName}'`);
  }

  /**
   * Initialize the engine and all registered drivers
   */
  async init() {
    this.logger.info('Initializing ObjectQL engine', { 
      driverCount: this.drivers.size,
      drivers: Array.from(this.drivers.keys())
    });
    
    for (const [name, driver] of this.drivers) {
      try {
        await driver.connect();
        this.logger.info('Driver connected successfully', { driverName: name });
      } catch (e) {
        this.logger.error('Failed to connect driver', e as Error, { driverName: name });
      }
    }
    
    this.logger.info('ObjectQL engine initialization complete');
  }

  async destroy() {
    this.logger.info('Destroying ObjectQL engine', { driverCount: this.drivers.size });
    
    for (const [name, driver] of this.drivers.entries()) {
      try {
        await driver.disconnect();
      } catch (e) {
        this.logger.error('Error disconnecting driver', e as Error, { driverName: name });
      }
    }
    
    this.logger.info('ObjectQL engine destroyed');
  }

  // ============================================
  // Helper: Expand Related Records
  // ============================================

  /** Maximum depth for recursive expand to prevent infinite loops */
  private static readonly MAX_EXPAND_DEPTH = 3;

  /**
   * Post-process expand: resolve lookup/master_detail fields by batch-loading related records.
   * 
   * This is a driver-agnostic implementation that uses secondary queries ($in batches)
   * to load related records, then injects them into the result set.
   * 
   * @param objectName - The source object name
   * @param records - The records returned by the driver
   * @param expand - The expand map from QueryAST (field name → nested QueryAST)
   * @param depth - Current recursion depth (0-based)
   * @returns Records with expanded lookup fields (IDs replaced by full objects)
   */
  private async expandRelatedRecords(
    objectName: string,
    records: any[],
    expand: Record<string, QueryAST>,
    depth: number = 0,
  ): Promise<any[]> {
    if (!records || records.length === 0) return records;
    if (depth >= ObjectQL.MAX_EXPAND_DEPTH) return records;

    const objectSchema = SchemaRegistry.getObject(objectName);
    // If no schema registered, skip expand — return raw data
    if (!objectSchema || !objectSchema.fields) return records;

    for (const [fieldName, nestedAST] of Object.entries(expand)) {
      const fieldDef = objectSchema.fields[fieldName];

      // Skip if field not found or not a relationship type
      if (!fieldDef || !fieldDef.reference) continue;
      if (fieldDef.type !== 'lookup' && fieldDef.type !== 'master_detail') continue;

      const referenceObject = fieldDef.reference;

      // Collect all foreign key IDs from records (handle both single and multiple values)
      const allIds: any[] = [];
      for (const record of records) {
        const val = record[fieldName];
        if (val == null) continue;
        if (Array.isArray(val)) {
          allIds.push(...val.filter((id: any) => id != null));
        } else if (typeof val === 'object') {
          // Already expanded — skip
          continue;
        } else {
          allIds.push(val);
        }
      }

      // De-duplicate IDs
      const uniqueIds = [...new Set(allIds)];
      if (uniqueIds.length === 0) continue;

      // Batch-load related records using $in query
      try {
        const relatedQuery: QueryAST = {
          object: referenceObject,
          where: { id: { $in: uniqueIds } },
          ...(nestedAST.fields ? { fields: nestedAST.fields } : {}),
          ...(nestedAST.orderBy ? { orderBy: nestedAST.orderBy } : {}),
        };

        const driver = this.getDriver(referenceObject);
        const relatedRecords = await driver.find(referenceObject, relatedQuery) ?? [];

        // Build a lookup map: id → record
        const recordMap = new Map<string, any>();
        for (const rec of relatedRecords) {
          const id = rec.id;
          if (id != null) recordMap.set(String(id), rec);
        }

        // Recursively expand nested relations if present
        if (nestedAST.expand && Object.keys(nestedAST.expand).length > 0) {
          const expandedRelated = await this.expandRelatedRecords(
            referenceObject,
            relatedRecords,
            nestedAST.expand,
            depth + 1,
          );
          // Rebuild map with expanded records
          recordMap.clear();
          for (const rec of expandedRelated) {
            const id = rec.id;
            if (id != null) recordMap.set(String(id), rec);
          }
        }

        // Inject expanded records back into the original result set
        for (const record of records) {
          const val = record[fieldName];
          if (val == null) continue;

          if (Array.isArray(val)) {
            record[fieldName] = val.map((id: any) => recordMap.get(String(id)) ?? id);
          } else if (typeof val !== 'object') {
            record[fieldName] = recordMap.get(String(val)) ?? val;
          }
          // If val is already an object, leave it as-is
        }
      } catch (e) {
        // Graceful degradation: if expand fails, keep original IDs
        this.logger.warn('Failed to expand relationship field; retaining foreign key IDs', {
          object: objectName,
          field: fieldName,
          reference: referenceObject,
          error: (e as Error).message,
        });
      }
    }

    return records;
  }

  // ============================================
  // Data Access Methods (IDataEngine Interface)
  // ============================================

  async find(object: string, query?: EngineQueryOptions): Promise<any[]> {
    object = this.resolveObjectName(object);
    this.logger.debug('Find operation starting', { object, query });
    const driver = this.getDriver(object);
    const ast: QueryAST = { object, ...query };
    // Remove context from the AST — it's not a driver concern
    delete (ast as any).context;

    const opCtx: OperationContext = {
      object,
      operation: 'find',
      ast,
      options: query,
      context: query?.context,
    };

    await this.executeWithMiddleware(opCtx, async () => {
      const hookContext: HookContext = {
          object,
          event: 'beforeFind',
          input: { ast: opCtx.ast, options: opCtx.options },
          session: this.buildSession(opCtx.context),
          transaction: opCtx.context?.transaction,
          ql: this
      };
      await this.triggerHooks('beforeFind', hookContext);

      try {
          let result = await driver.find(object, hookContext.input.ast as QueryAST, hookContext.input.options as any);

          // Post-process: expand related records if expand is requested
          if (ast.expand && Object.keys(ast.expand).length > 0 && Array.isArray(result)) {
            result = await this.expandRelatedRecords(object, result, ast.expand, 0);
          }
          
          hookContext.event = 'afterFind';
          hookContext.result = result;
          await this.triggerHooks('afterFind', hookContext);
          
          return hookContext.result;
      } catch (e) {
          this.logger.error('Find operation failed', e as Error, { object });
          throw e;
      }
    });

    return opCtx.result as any[];
  }

  async findOne(objectName: string, query?: EngineQueryOptions): Promise<any> {
    objectName = this.resolveObjectName(objectName);
    this.logger.debug('FindOne operation', { objectName });
    const driver = this.getDriver(objectName);
    const ast: QueryAST = { object: objectName, ...query, limit: 1 };
    // Remove context from the AST — it's not a driver concern
    delete (ast as any).context;

    const opCtx: OperationContext = {
      object: objectName,
      operation: 'findOne',
      ast,
      options: query,
      context: query?.context,
    };

    await this.executeWithMiddleware(opCtx, async () => {
      let result = await driver.findOne(objectName, opCtx.ast as QueryAST);

      // Post-process: expand related records if expand is requested
      if (ast.expand && Object.keys(ast.expand).length > 0 && result != null) {
        const expanded = await this.expandRelatedRecords(objectName, [result], ast.expand, 0);
        result = expanded[0];
      }

      return result;
    });

    return opCtx.result;
  }

  async insert(object: string, data: any | any[], options?: DataEngineInsertOptions): Promise<any> {
    object = this.resolveObjectName(object);
    this.logger.debug('Insert operation starting', { object, isBatch: Array.isArray(data) });
    const driver = this.getDriver(object);

    const opCtx: OperationContext = {
      object,
      operation: 'insert',
      data,
      options,
      context: options?.context,
    };

    await this.executeWithMiddleware(opCtx, async () => {
      const hookContext: HookContext = {
          object,
          event: 'beforeInsert',
          input: { data: opCtx.data, options: opCtx.options },
          session: this.buildSession(opCtx.context),
          transaction: opCtx.context?.transaction,
          ql: this
      };
      await this.triggerHooks('beforeInsert', hookContext);

      try {
        let result;
        if (Array.isArray(hookContext.input.data)) {
          // Bulk Create
          if (driver.bulkCreate) {
               result = await driver.bulkCreate(object, hookContext.input.data as any[], hookContext.input.options as any);
          } else {
               // Fallback loop
               result = await Promise.all((hookContext.input.data as any[]).map((item: any) => driver.create(object, item, hookContext.input.options as any)));
          }
        } else {
          result = await driver.create(object, hookContext.input.data as Record<string, unknown>, hookContext.input.options as any);
        }

        hookContext.event = 'afterInsert';
        hookContext.result = result;
        await this.triggerHooks('afterInsert', hookContext);

        return hookContext.result;
      } catch (e) {
        this.logger.error('Insert operation failed', e as Error, { object });
        throw e;
      }
    });

    return opCtx.result;
  }

  async update(object: string, data: any, options?: EngineUpdateOptions): Promise<any> {
     object = this.resolveObjectName(object);
     this.logger.debug('Update operation starting', { object });
     const driver = this.getDriver(object);
     
     // 1. Extract ID from data or where if it's a single update by ID
     let id = data.id;
     if (!id && options?.where) {
         if (typeof options.where === 'string') id = options.where;
         else if (options.where.id) id = options.where.id;
     }

     const opCtx: OperationContext = {
       object,
       operation: 'update',
       data,
       options,
       context: options?.context,
     };

     await this.executeWithMiddleware(opCtx, async () => {
       const hookContext: HookContext = {
          object,
          event: 'beforeUpdate',
          input: { id, data: opCtx.data, options: opCtx.options },
          session: this.buildSession(opCtx.context),
          transaction: opCtx.context?.transaction,
          ql: this
       };
       await this.triggerHooks('beforeUpdate', hookContext);

       try {
           let result;
           if (hookContext.input.id) {
               result = await driver.update(object, hookContext.input.id as string, hookContext.input.data as Record<string, unknown>, hookContext.input.options as any);
           } else if (options?.multi && driver.updateMany) {
               const ast: QueryAST = { object, where: options.where };
               result = await driver.updateMany(object, ast, hookContext.input.data as Record<string, unknown>, hookContext.input.options as any);
           } else {
               throw new Error('Update requires an ID or options.multi=true');
           }

           hookContext.event = 'afterUpdate';
           hookContext.result = result;
           await this.triggerHooks('afterUpdate', hookContext);
           return hookContext.result;
       } catch (e) {
          this.logger.error('Update operation failed', e as Error, { object });
          throw e;
       }
     });

     return opCtx.result;
  }

  async delete(object: string, options?: EngineDeleteOptions): Promise<any> {
    object = this.resolveObjectName(object);
    this.logger.debug('Delete operation starting', { object });
    const driver = this.getDriver(object);

    // Extract ID logic similar to update
    let id: any = undefined;
    if (options?.where) {
         if (typeof options.where === 'string') id = options.where;
         else if (options.where.id) id = options.where.id;
    }

    const opCtx: OperationContext = {
      object,
      operation: 'delete',
      options,
      context: options?.context,
    };

    await this.executeWithMiddleware(opCtx, async () => {
      const hookContext: HookContext = {
          object,
          event: 'beforeDelete',
          input: { id, options: opCtx.options },
          session: this.buildSession(opCtx.context),
          transaction: opCtx.context?.transaction,
          ql: this
      };
      await this.triggerHooks('beforeDelete', hookContext);

      try {
          let result;
          if (hookContext.input.id) {
              result = await driver.delete(object, hookContext.input.id as string, hookContext.input.options as any);
          } else if (options?.multi && driver.deleteMany) {
               const ast: QueryAST = { object, where: options.where };
               result = await driver.deleteMany(object, ast, hookContext.input.options as any);
          } else {
               throw new Error('Delete requires an ID or options.multi=true');
          }

          hookContext.event = 'afterDelete';
          hookContext.result = result;
          await this.triggerHooks('afterDelete', hookContext);
          return hookContext.result;
      } catch (e) {
          this.logger.error('Delete operation failed', e as Error, { object });
          throw e;
      }
    });

    return opCtx.result;
  }

  async count(object: string, query?: EngineCountOptions): Promise<number> {
     object = this.resolveObjectName(object);
     const driver = this.getDriver(object);

     const opCtx: OperationContext = {
       object,
       operation: 'count',
       options: query,
       context: query?.context,
     };

     await this.executeWithMiddleware(opCtx, async () => {
       if (driver.count) {
           const ast: QueryAST = { object, where: query?.where };
           return driver.count(object, ast);
       }
       // Fallback to find().length
       const res = await this.find(object, { where: query?.where, fields: ['id'] });
       return res.length;
     });

     return opCtx.result as number;
  }

  async aggregate(object: string, query: EngineAggregateOptions): Promise<any[]> {
      object = this.resolveObjectName(object);
      const driver = this.getDriver(object);
      this.logger.debug(`Aggregate on ${object} using ${driver.name}`, query);

      const opCtx: OperationContext = {
        object,
        operation: 'aggregate',
        options: query,
        context: query?.context,
      };

      await this.executeWithMiddleware(opCtx, async () => {
        const ast: QueryAST = {
            object,
            where: query.where,
            groupBy: query.groupBy,
            aggregations: query.aggregations,
        };

        return driver.find(object, ast);
      });

      return opCtx.result as any[];
  }
  
  async execute(command: any, options?: Record<string, any>): Promise<any> {
      // Direct pass-through implies we know which driver to use?
      // Usually execute is tied to a specific object context OR we need a way to select driver.
      // If command has 'object', we use that.
      if (options?.object) {
          const driver = this.getDriver(options.object);
          if (driver.execute) {
              return driver.execute(command, undefined, options);
          }
      }
      throw new Error('Execute requires options.object to select driver');
  }

  // ============================================
  // Compatibility / Convenience API
  // ============================================
  // These methods provide a higher-level API matching the @objectql/core
  // ObjectQL interface, enabling painless migration from the legacy layer.

  /**
   * Register a single object definition.
   * 
   * Proxies to SchemaRegistry.registerObject() with sensible defaults.
   * Fields without a `name` property are auto-assigned from their key.
   */
  registerObject(
    schema: ServiceObject,
    packageId: string = '__runtime__',
    namespace?: string
  ): string {
    // Auto-assign field names from keys
    if (schema.fields) {
      for (const [key, field] of Object.entries(schema.fields)) {
        if (field && typeof field === 'object' && !('name' in field)) {
          (field as any).name = key;
        }
      }
    }
    return SchemaRegistry.registerObject(schema, packageId, namespace);
  }

  /**
   * Unregister a single object by name.
   */
  unregisterObject(name: string, packageId?: string): void {
    if (packageId) {
      SchemaRegistry.unregisterObjectsByPackage(packageId);
    } else {
      // Remove from generic metadata as fallback
      SchemaRegistry.unregisterItem('object', name);
    }
  }

  /**
   * Get an object definition by name.
   * Alias for getSchema() — matches @objectql/core API.
   */
  getObject(name: string): ServiceObject | undefined {
    return this.getSchema(name);
  }

  /**
   * Get all registered object configs as a name→config map.
   * Matches @objectql/core getConfigs() API.
   */
  getConfigs(): Record<string, ServiceObject> {
    const result: Record<string, ServiceObject> = {};
    const objects = SchemaRegistry.getAllObjects();
    for (const obj of objects) {
      if (obj.name) {
        result[obj.name] = obj;
      }
    }
    return result;
  }

  /**
   * Get a registered driver by datasource name.
   * 
   * Unlike the private getDriver() (which resolves by object name),
   * this method directly looks up a driver by its registered name.
   */
  getDriverByName(name: string): DriverInterface | undefined {
    return this.drivers.get(name);
  }

  /**
   * Get the driver responsible for the given object.
   *
   * Resolves datasource binding from the object's schema definition,
   * falling back to the default driver. This is a public version of
   * the internal getDriver() used by CRUD operations.
   *
   * @param objectName - FQN or short name of the registered object.
   * @returns The resolved DriverInterface, or undefined if no driver is available.
   */
  getDriverForObject(objectName: string): DriverInterface | undefined {
    try {
      return this.getDriver(objectName);
    } catch {
      return undefined;
    }
  }

  /**
   * Get a registered driver by datasource name.
   * Alias matching @objectql/core datasource() API.
   * 
   * @throws Error if the datasource is not found
   */
  datasource(name: string): DriverInterface {
    const driver = this.drivers.get(name);
    if (!driver) {
      throw new Error(`[ObjectQL] Datasource '${name}' not found`);
    }
    return driver;
  }

  /**
   * Register a hook handler.
   * Convenience alias for registerHook() matching @objectql/core on() API.
   * 
   * Usage:
   *   ql.on('beforeInsert', 'user', async (ctx) => { ... });
   */
  on(
    event: string,
    objectName: string,
    handler: (ctx: HookContext) => Promise<void> | void,
    packageId?: string
  ): void {
    this.registerHook(event, handler, { object: objectName, packageId });
  }

  /**
   * Remove all hooks, actions, and objects contributed by a package.
   */
  removePackage(packageId: string): void {
    // Remove hooks
    for (const [key, handlers] of this.hooks.entries()) {
      const filtered = handlers.filter(h => h.packageId !== packageId);
      if (filtered.length !== handlers.length) {
        this.hooks.set(key, filtered);
      }
    }
    // Remove actions
    this.removeActionsByPackage(packageId);
    // Remove objects
    SchemaRegistry.unregisterObjectsByPackage(packageId, true);
  }

  /**
   * Gracefully shut down the engine, disconnecting all drivers.
   * Alias for destroy() — matches @objectql/core close() API.
   */
  async close(): Promise<void> {
    return this.destroy();
  }

  /**
   * Create a scoped execution context bound to this engine.
   * 
   * Usage:
   *   const ctx = engine.createContext({ userId: '...', tenantId: '...' });
   *   const users = ctx.object('user');
   *   await users.find({ filter: { status: 'active' } });
   */
  createContext(ctx: Partial<ExecutionContext>): ScopedContext {
    return new ScopedContext(
      ExecutionContextSchema.parse(ctx),
      this
    );
  }

  /**
   * Static factory: create a fully configured ObjectQL instance.
   * 
   * Matches @objectql/core's `new ObjectQL(config)` pattern but also
   * registers drivers and objects, then calls init().
   * 
   * Usage:
   *   const ql = await ObjectQL.create({
   *     datasources: { default: myDriver },
   *     objects: { user: { name: 'user', fields: { ... } } }
   *   });
   */
  static async create(config: {
    datasources?: Record<string, DriverInterface>;
    objects?: Record<string, ServiceObject>;
    hooks?: Array<{ event: string; object: string; handler: (ctx: HookContext) => Promise<void> | void }>;
  }): Promise<ObjectQL> {
    const ql = new ObjectQL();

    // Register drivers
    if (config.datasources) {
      for (const [name, driver] of Object.entries(config.datasources)) {
        // Set driver name if not already set
        if (!driver.name) {
          (driver as any).name = name;
        }
        ql.registerDriver(driver, name === 'default');
      }
    }

    // Register objects
    if (config.objects) {
      for (const [_key, schema] of Object.entries(config.objects)) {
        ql.registerObject(schema);
      }
    }

    // Register hooks
    if (config.hooks) {
      for (const hook of config.hooks) {
        ql.on(hook.event, hook.object, hook.handler);
      }
    }

    // Initialize (connect drivers)
    await ql.init();

    return ql;
  }
}

/**
 * Repository scoped to a single object, bound to an execution context.
 *
 * Provides both IDataEngine-style methods (find, insert, update, delete)
 * and convenience aliases (create, updateById, deleteById) matching
 * the @objectql/core ObjectRepository API.
 */
export class ObjectRepository {
  constructor(
    private objectName: string,
    private context: ExecutionContext,
    private engine: IDataEngine & { executeAction?: (o: string, a: string, c: any) => Promise<any> }
  ) {}

  async find(query: any = {}): Promise<any[]> {
    return this.engine.find(this.objectName, {
      ...query,
      context: this.context,
    });
  }

  async findOne(query: any = {}): Promise<any> {
    return this.engine.findOne(this.objectName, {
      ...query,
      context: this.context,
    });
  }

  async insert(data: any): Promise<any> {
    return this.engine.insert(this.objectName, data, {
      context: this.context,
    });
  }

  /** Alias for insert() — matches @objectql/core convention */
  async create(data: any): Promise<any> {
    return this.insert(data);
  }

  async update(data: any, options: any = {}): Promise<any> {
    return this.engine.update(this.objectName, data, {
      ...options,
      context: this.context,
    });
  }

  /** Update a single record by ID */
  async updateById(id: string | number, data: any): Promise<any> {
    return this.engine.update(this.objectName, { ...data, id: id }, {
      where: { id: id },
      context: this.context,
    });
  }

  async delete(options: any = {}): Promise<any> {
    return this.engine.delete(this.objectName, {
      ...options,
      context: this.context,
    });
  }

  /** Delete a single record by ID */
  async deleteById(id: string | number): Promise<any> {
    return this.engine.delete(this.objectName, {
      where: { id: id },
      context: this.context,
    });
  }

  async count(query: any = {}): Promise<number> {
    return this.engine.count(this.objectName, {
      ...query,
      context: this.context,
    });
  }

  /** Aggregate query */
  async aggregate(query: any = {}): Promise<any[]> {
    return this.engine.aggregate(this.objectName, {
      ...query,
      context: this.context,
    });
  }

  /** Execute a named action registered on this object */
  async execute(actionName: string, params?: any): Promise<any> {
    if (this.engine.executeAction) {
      return this.engine.executeAction(this.objectName, actionName, {
        ...params,
        userId: this.context.userId,
        tenantId: this.context.tenantId,
        roles: this.context.roles,
      });
    }
    throw new Error(`Actions not supported by engine`);
  }
}

/**
 * Scoped execution context with object() accessor.
 * 
 * Provides identity (userId, tenantId/spaceId, roles),
 * repository access via object(), privilege escalation via sudo(),
 * and transactional execution via transaction().
 */
export class ScopedContext {
  constructor(
    private executionContext: ExecutionContext,
    private engine: IDataEngine
  ) {}

  /** Get a repository scoped to this context */
  object(name: string): ObjectRepository {
    return new ObjectRepository(name, this.executionContext, this.engine as any);
  }

  /** Create an elevated (system) context */
  sudo(): ScopedContext {
    return new ScopedContext(
      { ...this.executionContext, isSystem: true },
      this.engine
    );
  }

  /**
   * Execute a callback within a database transaction.
   *
   * The callback receives a new ScopedContext whose operations
   * share the same transaction handle. If the callback throws,
   * the transaction is rolled back; otherwise it is committed.
   *
   * Falls back to non-transactional execution if the driver
   * does not support transactions.
   */
  async transaction(callback: (trxCtx: ScopedContext) => Promise<any>): Promise<any> {
    const engine = this.engine as any;

    // Find the default driver for transaction support
    const driver = engine.defaultDriver
      ? engine.drivers?.get(engine.defaultDriver)
      : undefined;

    if (!driver?.beginTransaction) {
      // No transaction support — execute directly
      return callback(this);
    }

    const trx = await driver.beginTransaction();
    const trxCtx = new ScopedContext(
      { ...this.executionContext, transaction: trx },
      this.engine
    );

    try {
      const result = await callback(trxCtx);
      if (driver.commit) await driver.commit(trx);
      else if (driver.commitTransaction) await driver.commitTransaction(trx);
      return result;
    } catch (error) {
      if (driver.rollback) await driver.rollback(trx);
      else if (driver.rollbackTransaction) await driver.rollbackTransaction(trx);
      throw error;
    }
  }

  get userId() { return this.executionContext.userId; }
  get tenantId() { return this.executionContext.tenantId; }
  /** Alias for tenantId — matches ObjectQLContext.spaceId convention */
  get spaceId() { return this.executionContext.tenantId; }
  get roles() { return this.executionContext.roles; }
  get isSystem() { return this.executionContext.isSystem; }

  /** Internal: expose the transaction handle for driver-level access */
  get transactionHandle() { return this.executionContext.transaction; }
}
