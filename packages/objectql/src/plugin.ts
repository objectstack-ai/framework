// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ObjectQL } from './engine.js';
import { ObjectStackProtocolImplementation } from './protocol.js';
import { Plugin, PluginContext } from '@objectstack/core';

export type { Plugin, PluginContext };

export class ObjectQLPlugin implements Plugin {
  name = 'com.objectstack.engine.objectql';
  type = 'objectql';
  version = '1.0.0';
  
  private ql: ObjectQL | undefined;
  private hostContext?: Record<string, any>;

  constructor(ql?: ObjectQL, hostContext?: Record<string, any>) {
    if (ql) {
        this.ql = ql;
    } else {
        this.hostContext = hostContext;
        // Lazily created in init
    }
  }

  init = async (ctx: PluginContext) => {
    if (!this.ql) {
        // Pass kernel logger to engine to avoid creating a separate pino instance
        const hostCtx = { ...this.hostContext, logger: ctx.logger };
        this.ql = new ObjectQL(hostCtx);
    }
    
    // Register as provider for Core Kernel Services
    ctx.registerService('objectql', this.ql);

    ctx.registerService('data', this.ql); // ObjectQL implements IDataEngine

    // Register manifest service for direct app/package registration.
    // Plugins call ctx.getService('manifest').register(manifestData)
    // instead of the legacy ctx.registerService('app.<id>', manifestData) convention.
    const ql = this.ql;
    ctx.registerService('manifest', {
      register: (manifest: any) => {
        ql.registerApp(manifest);
        ctx.logger.debug('Manifest registered via manifest service', {
          id: manifest.id || manifest.name
        });
      }
    });

    ctx.logger.info('ObjectQL engine registered', {
        services: ['objectql', 'data', 'manifest'],
    });

    // Register Protocol Implementation
    const protocolShim = new ObjectStackProtocolImplementation(
      this.ql, 
      () => ctx.getServices ? ctx.getServices() : new Map()
    );

    ctx.registerService('protocol', protocolShim);
    ctx.logger.info('Protocol service registered');
  }

  start = async (ctx: PluginContext) => {
    ctx.logger.info('ObjectQL engine starting...');

    // Sync from external metadata service (e.g. MetadataPlugin) if available
    try {
        const metadataService = ctx.getService('metadata') as any;
        if (metadataService && typeof metadataService.loadMany === 'function' && this.ql) {
            await this.loadMetadataFromService(metadataService, ctx);
        }
    } catch (e: any) {
        ctx.logger.debug('No external metadata service to sync from');
    }
    
    // Discover features from Kernel Services
    if (ctx.getServices && this.ql) {
        const services = ctx.getServices();
        for (const [name, service] of services.entries()) {
            if (name.startsWith('driver.')) {
                 // Register Driver
                 this.ql.registerDriver(service);
                 ctx.logger.debug('Discovered and registered driver service', { serviceName: name });
            }
            if (name.startsWith('app.')) {
                // Legacy fallback: discover app.* services (DEPRECATED)
                ctx.logger.warn(
                    `[DEPRECATED] Service "${name}" uses legacy app.* convention. ` +
                    `Migrate to ctx.getService('manifest').register(data).`
                );
                this.ql.registerApp(service); // service is Manifest
                ctx.logger.debug('Discovered and registered app service (legacy)', { serviceName: name });
            }
        }
    }

    // Initialize drivers (calls driver.connect() which sets up persistence)
    await this.ql?.init();

    // Sync all registered object schemas to database
    // This ensures tables/collections are created or updated for every
    // object registered by plugins (e.g., sys_user from plugin-auth).
    await this.syncRegisteredSchemas(ctx);

    // Register built-in audit hooks
    this.registerAuditHooks(ctx);

    // Register tenant isolation middleware
    this.registerTenantMiddleware(ctx);
    
    ctx.logger.info('ObjectQL engine started', {
        driversRegistered: this.ql?.['drivers']?.size || 0,
        objectsRegistered: this.ql?.registry?.getAllObjects?.()?.length || 0
    });
  }

  /**
   * Register built-in audit hooks for auto-stamping created_by/updated_by
   * and fetching previousData for update/delete operations.
   */
  private registerAuditHooks(ctx: PluginContext) {
    if (!this.ql) return;

    // Auto-stamp created_by/updated_by on insert
    this.ql.registerHook('beforeInsert', async (hookCtx) => {
      if (hookCtx.session?.userId && hookCtx.input?.data) {
        const data = hookCtx.input.data as Record<string, any>;
        if (typeof data === 'object' && data !== null) {
          data.created_by = data.created_by ?? hookCtx.session.userId;
          data.updated_by = hookCtx.session.userId;
          data.created_at = data.created_at ?? new Date().toISOString();
          data.updated_at = new Date().toISOString();
          if (hookCtx.session.tenantId) {
            data.tenant_id = data.tenant_id ?? hookCtx.session.tenantId;
          }
        }
      }
    }, { object: '*', priority: 10 });

    // Auto-stamp updated_by on update
    this.ql.registerHook('beforeUpdate', async (hookCtx) => {
      if (hookCtx.session?.userId && hookCtx.input?.data) {
        const data = hookCtx.input.data as Record<string, any>;
        if (typeof data === 'object' && data !== null) {
          data.updated_by = hookCtx.session.userId;
          data.updated_at = new Date().toISOString();
        }
      }
    }, { object: '*', priority: 10 });

    // Auto-fetch previousData for update hooks
    this.ql.registerHook('beforeUpdate', async (hookCtx) => {
      if (hookCtx.input?.id && !hookCtx.previous) {
        try {
          const existing = await this.ql!.findOne(hookCtx.object, {
            where: { id: hookCtx.input.id }
          });
          if (existing) {
            hookCtx.previous = existing;
          }
        } catch (_e) {
          // Non-fatal: some objects may not support findOne
        }
      }
    }, { object: '*', priority: 5 });

    // Auto-fetch previousData for delete hooks
    this.ql.registerHook('beforeDelete', async (hookCtx) => {
      if (hookCtx.input?.id && !hookCtx.previous) {
        try {
          const existing = await this.ql!.findOne(hookCtx.object, {
            where: { id: hookCtx.input.id }
          });
          if (existing) {
            hookCtx.previous = existing;
          }
        } catch (_e) {
          // Non-fatal
        }
      }
    }, { object: '*', priority: 5 });

    ctx.logger.debug('Audit hooks registered (created_by/updated_by, previousData)');
  }

  /**
   * Register tenant isolation middleware that auto-injects tenant_id filter
   * for multi-tenant operations.
   */
  private registerTenantMiddleware(ctx: PluginContext) {
    if (!this.ql) return;

    this.ql.registerMiddleware(async (opCtx, next) => {
      // Only apply to operations with tenantId that are not system-level
      if (!opCtx.context?.tenantId || opCtx.context?.isSystem) {
        return next();
      }

      // Read operations: inject tenant_id filter into AST
      if (['find', 'findOne', 'count', 'aggregate'].includes(opCtx.operation)) {
        if (opCtx.ast) {
          const tenantFilter = { tenant_id: opCtx.context.tenantId };
          if (opCtx.ast.where) {
            opCtx.ast.where = { $and: [opCtx.ast.where, tenantFilter] };
          } else {
            opCtx.ast.where = tenantFilter;
          }
        }
      }

      await next();
    });

    ctx.logger.debug('Tenant isolation middleware registered');
  }

  /**
   * Synchronize all registered object schemas to the database.
   *
   * Groups objects by their responsible driver, then:
   * - If the driver advertises `supports.batchSchemaSync` and implements
   *   `syncSchemasBatch()`, submits all schemas in a single call (reducing
   *   network round-trips for remote drivers like Turso).
   * - Otherwise falls back to sequential `syncSchema()` per object.
   *
   * This is idempotent — drivers must tolerate repeated calls without
   * duplicating tables or erroring out.
   *
   * Drivers that do not implement `syncSchema` are silently skipped.
   */
  private async syncRegisteredSchemas(ctx: PluginContext) {
    if (!this.ql) return;

    const allObjects = this.ql.registry?.getAllObjects?.() ?? [];
    if (allObjects.length === 0) return;

    let synced = 0;
    let skipped = 0;

    // Group objects by driver for potential batch optimization
    const driverGroups = new Map<any, Array<{ obj: any; tableName: string }>>();

    for (const obj of allObjects) {
      const driver = this.ql.getDriverForObject(obj.name);
      if (!driver) {
        ctx.logger.debug('No driver available for object, skipping schema sync', {
          object: obj.name,
        });
        skipped++;
        continue;
      }

      if (typeof driver.syncSchema !== 'function') {
        ctx.logger.debug('Driver does not support syncSchema, skipping', {
          object: obj.name,
          driver: driver.name,
        });
        skipped++;
        continue;
      }

      const tableName = obj.tableName || obj.name;

      let group = driverGroups.get(driver);
      if (!group) {
        group = [];
        driverGroups.set(driver, group);
      }
      group.push({ obj, tableName });
    }

    // Process each driver group
    for (const [driver, entries] of driverGroups) {
      // Batch path: driver supports batch schema sync
      if (
        driver.supports?.batchSchemaSync &&
        typeof driver.syncSchemasBatch === 'function'
      ) {
        const batchPayload = entries.map((e) => ({
          object: e.tableName,
          schema: e.obj,
        }));
        try {
          await driver.syncSchemasBatch(batchPayload);
          synced += entries.length;
          ctx.logger.debug('Batch schema sync succeeded', {
            driver: driver.name,
            count: entries.length,
          });
        } catch (e: unknown) {
          ctx.logger.warn('Batch schema sync failed, falling back to sequential', {
            driver: driver.name,
            error: e instanceof Error ? e.message : String(e),
          });
          // Fallback: sequential sync for this driver's objects
          for (const { obj, tableName } of entries) {
            try {
              await driver.syncSchema(tableName, obj);
              synced++;
            } catch (seqErr: unknown) {
              ctx.logger.warn('Failed to sync schema for object', {
                object: obj.name,
                tableName,
                driver: driver.name,
                error: seqErr instanceof Error ? seqErr.message : String(seqErr),
              });
            }
          }
        }
      } else {
        // Sequential path: no batch support
        for (const { obj, tableName } of entries) {
          try {
            await driver.syncSchema(tableName, obj);
            synced++;
          } catch (e: unknown) {
            ctx.logger.warn('Failed to sync schema for object', {
              object: obj.name,
              tableName,
              driver: driver.name,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }

    if (synced > 0 || skipped > 0) {
      ctx.logger.info('Schema sync complete', { synced, skipped, total: allObjects.length });
    }
  }

  /**
   * Load metadata from external metadata service into ObjectQL registry
   * This enables ObjectQL to use file-based or remote metadata
   */
  private async loadMetadataFromService(metadataService: any, ctx: PluginContext) {
    ctx.logger.info('Syncing metadata from external service into ObjectQL registry...');
    
    // Metadata types to sync
    const metadataTypes = ['object', 'view', 'app', 'flow', 'workflow', 'function'];
    let totalLoaded = 0;
    
    for (const type of metadataTypes) {
        try {
            // Check if service has loadMany method
            if (typeof metadataService.loadMany === 'function') {
                const items = await metadataService.loadMany(type);
                
                if (items && items.length > 0) {
                    items.forEach((item: any) => {
                        // Determine key field (usually 'name' or 'id')
                        const keyField = item.id ? 'id' : 'name';
                        
                        // For objects, use the ownership-aware registration
                        if (type === 'object' && this.ql) {
                            // Objects are registered differently (ownership model)
                            // Skip for now - handled by app registration
                            return;
                        }
                        
                        // Register other types in the registry
                        if (this.ql?.registry?.registerItem) {
                            this.ql.registry.registerItem(type, item, keyField);
                        }
                    });
                    
                    totalLoaded += items.length;
                    ctx.logger.info(`Synced ${items.length} ${type}(s) from metadata service`);
                }
            }
        } catch (e: any) {
            // Type might not exist in metadata service - that's ok
            ctx.logger.debug(`No ${type} metadata found or error loading`, { 
                error: e.message 
            });
        }
    }
    
    if (totalLoaded > 0) {
        ctx.logger.info(`Metadata sync complete: ${totalLoaded} items loaded into ObjectQL registry`);
    }
  }
}
