// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Plugin, PluginContext } from '@objectstack/core';
import type { PermissionSet, RowLevelSecurityPolicy } from '@objectstack/spec/security';
import { PermissionEvaluator } from './permission-evaluator.js';
import { RLSCompiler } from './rls-compiler.js';
import { FieldMasker } from './field-masker.js';
import { SysRole, SysPermissionSet } from './objects/index.js';

/**
 * SecurityPlugin
 * 
 * Provides RBAC, Row-Level Security, and Field-Level Security runtime.
 * Registers as an engine middleware on the ObjectQL engine.
 * 
 * This plugin is fully optional — without it, the system operates
 * without permission checks (same as current behavior).
 * 
 * Dependencies:
 * - objectql service (ObjectQL engine with middleware support)
 * - metadata service (MetadataFacade for reading permission sets and RLS policies)
 */
export class SecurityPlugin implements Plugin {
  name = 'com.objectstack.security';
  type = 'standard';
  version = '1.0.0';
  dependencies = ['com.objectstack.engine.objectql'];

  private permissionEvaluator = new PermissionEvaluator();
  private rlsCompiler = new RLSCompiler();
  private fieldMasker = new FieldMasker();

  async init(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Initializing Security Plugin...');

    // Register security services
    ctx.registerService('security.permissions', this.permissionEvaluator);
    ctx.registerService('security.rls', this.rlsCompiler);
    ctx.registerService('security.fieldMasker', this.fieldMasker);

    // Register security system objects via the manifest service.
    ctx.getService<{ register(m: any): void }>('manifest').register({
      id: 'com.objectstack.security',
      name: 'Security',
      version: '1.0.0',
      type: 'plugin',
      namespace: 'sys',
      objects: [SysRole, SysPermissionSet],
    });

    // Contribute navigation items to the Setup App (if SetupPlugin is loaded).
    try {
      const setupNav = ctx.getService<{ contribute(c: any): void }>('setupNav');
      if (setupNav) {
        setupNav.contribute({
          areaId: 'area_administration',
          items: [
            { id: 'nav_roles', type: 'object', label: 'Roles', objectName: 'role', icon: 'shield-check', order: 60 },
            { id: 'nav_permission_sets', type: 'object', label: 'Permission Sets', objectName: 'permission_set', icon: 'lock', order: 70 },
          ],
        });
        ctx.logger.info('Security navigation items contributed to Setup App');
      }
    } catch {
      // SetupPlugin not loaded — skip silently
    }

    ctx.logger.info('Security Plugin initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    ctx.logger.info('Starting Security Plugin...');

    // Get required services
    let ql: any;
    let metadata: any;

    try {
      ql = ctx.getService('objectql');
      metadata = ctx.getService('metadata');
    } catch (e) {
      ctx.logger.warn('ObjectQL or metadata service not available, security middleware not registered');
      return;
    }

    if (!ql || typeof ql.registerMiddleware !== 'function') {
      ctx.logger.warn('ObjectQL engine does not support middleware, security middleware not registered');
      return;
    }

    // Register security middleware
    ql.registerMiddleware(async (opCtx: any, next: () => Promise<void>) => {
      // System operations bypass security
      if (opCtx.context?.isSystem) {
        return next();
      }

      const roles = opCtx.context?.roles ?? [];

      // Skip security checks if no roles (anonymous/unauthenticated)
      // The auth middleware should handle authentication separately
      if (roles.length === 0 && !opCtx.context?.userId) {
        return next();
      }

      // 1. Resolve permission sets for the user's roles
      let permissionSets: PermissionSet[] = [];
      try {
        permissionSets = this.permissionEvaluator.resolvePermissionSets(roles, metadata);
      } catch (e) {
        // If metadata service is misconfigured, log and continue without permission checks
        // rather than blocking all operations
        return next();
      }

      // 2. CRUD permission check
      if (permissionSets.length > 0) {
        const allowed = this.permissionEvaluator.checkObjectPermission(
          opCtx.operation,
          opCtx.object,
          permissionSets
        );

        if (!allowed) {
          throw new Error(
            `[Security] Access denied: operation '${opCtx.operation}' on object '${opCtx.object}' ` +
            `is not permitted for roles [${roles.join(', ')}]`
          );
        }
      }

      // 3. RLS filter injection
      const allRlsPolicies = this.collectRLSPolicies(permissionSets, opCtx.object, opCtx.operation);
      if (allRlsPolicies.length > 0 && opCtx.ast) {
        const rlsFilter = this.rlsCompiler.compileFilter(allRlsPolicies, opCtx.context);
        if (rlsFilter) {
          if (opCtx.ast.where) {
            opCtx.ast.where = { $and: [opCtx.ast.where, rlsFilter] };
          } else {
            opCtx.ast.where = rlsFilter;
          }
        }
      }

      await next();

      // 4. Field-level security: mask restricted fields in read results
      if (opCtx.result && ['find', 'findOne'].includes(opCtx.operation)) {
        const fieldPerms = this.permissionEvaluator.getFieldPermissions(opCtx.object, permissionSets);
        if (Object.keys(fieldPerms).length > 0) {
          opCtx.result = this.fieldMasker.maskResults(opCtx.result, fieldPerms, opCtx.object);
        }
      }
    });

    ctx.logger.info('Security middleware registered on ObjectQL engine');
  }

  async destroy(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Collect all RLS policies from permission sets applicable to the given object/operation.
   */
  private collectRLSPolicies(
    permissionSets: PermissionSet[],
    objectName: string,
    operation: string
  ): RowLevelSecurityPolicy[] {
    const allPolicies: RowLevelSecurityPolicy[] = [];

    for (const ps of permissionSets) {
      if (ps.rowLevelSecurity) {
        allPolicies.push(...ps.rowLevelSecurity);
      }
    }

    return this.rlsCompiler.getApplicablePolicies(objectName, operation, allPolicies);
  }
}
