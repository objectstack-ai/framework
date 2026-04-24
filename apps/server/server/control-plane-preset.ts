// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Control-Plane Plugin Preset
 *
 * Builds the plugin list that powers the shared Server's control plane:
 *  - ObjectQL + driver for sys_* tables (project registry, credentials, …)
 *  - Tenant plugin (registers sys_project / sys_project_credential / …)
 *  - System project plugin (provisions the well-known SYSTEM_PROJECT_ID)
 *  - Auth / Security / Audit for platform-level authentication + RBAC
 *  - Package service for the package registry (ADR-0003)
 *  - Metadata service for schema read/write
 *
 * This was previously lived in `apps/cloud/objectstack.config.ts`. After
 * unifying cloud + server into a single process (per the transformation
 * plan) the preset is imported from the server bootstrap to initialise the
 * "system" kernel that owns the control-plane database.
 */

import type { Contracts } from '@objectstack/spec';
import {
  DriverPlugin,
  createSystemProjectPlugin,
} from '@objectstack/runtime';

type Plugin = any;
import { ObjectQLPlugin } from '@objectstack/objectql';
import { MetadataPlugin } from '@objectstack/metadata';
import { PackageServicePlugin } from '@objectstack/service-package';
import { createTenantPlugin } from '@objectstack/service-tenant';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { SecurityPlugin } from '@objectstack/plugin-security';
import { AuditPlugin } from '@objectstack/plugin-audit';

type IDataDriver = Contracts.IDataDriver;

export interface ControlPlanePresetConfig {
  /**
   * Pre-constructed control-plane driver (Turso or SQLite). The DriverPlugin
   * will register it under `com.objectstack.driver.<driver.name>`.
   */
  controlDriver: IDataDriver;

  /** Driver short id (e.g. `'turso'`, `'sqlite'`). */
  driverName: string;

  /** Auth secret (≥32 chars). */
  authSecret: string;

  /** Base URL used by AuthPlugin for absolute callback URLs. */
  baseUrl: string;

  /**
   * Whether to register Tenant sys objects (sys_project, sys_project_credential, …).
   * Defaults to true. Set to false for tests that mock the control plane.
   */
  registerSystemObjects?: boolean;

  /**
   * Whether to register the deprecated legacy tenant database object.
   * Defaults to false.
   */
  registerLegacyTenantDatabase?: boolean;

  /** Additional AuthPlugin plugin flags. */
  authPlugins?: Record<string, unknown>;
}

/**
 * Build the ordered plugin list that powers the control plane.
 *
 * Ordering notes (important):
 *  1. ObjectQLPlugin first so downstream plugins can register schema
 *     through its datasource mapping.
 *  2. Tiny inline plugin right after ObjectQL to set the datasource mapping
 *     (single-driver mapping — control plane only has one physical DB).
 *  3. DriverPlugin registers the control-plane driver.
 *  4. PackageServicePlugin + TenantPlugin + system project plugin introduce
 *     the sys_* objects.
 *  5. Auth/Security/Audit wire up authentication and policy.
 *  6. MetadataPlugin last — it snapshots the final schema registry.
 */
export function createControlPlanePlugins(cfg: ControlPlanePresetConfig): Plugin[] {
  const oqlPlugin = new ObjectQLPlugin();
  const datasourceMapping = [
    { default: true, datasource: `com.objectstack.driver.${cfg.driverName}` },
  ];

  return [
    oqlPlugin,
    {
      name: 'control-plane-datasource-mapping',
      init() {
        const ql = (oqlPlugin as any).ql;
        if (ql?.setDatasourceMapping) ql.setDatasourceMapping(datasourceMapping);
      },
    } as unknown as Plugin,
    new DriverPlugin(cfg.controlDriver as any, cfg.driverName),
    new PackageServicePlugin(),
    createTenantPlugin({
      registerSystemObjects: cfg.registerSystemObjects ?? true,
      registerLegacyTenantDatabase: cfg.registerLegacyTenantDatabase ?? false,
    }),
    createSystemProjectPlugin(),
    new AuthPlugin({
      secret: cfg.authSecret,
      baseUrl: cfg.baseUrl,
      plugins: (cfg.authPlugins ?? { organization: true }) as any,
      socialProviders: (() => {
        const p: Record<string, { clientId: string; clientSecret: string }> = {};
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
          p.google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
        if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
          p.github = { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET };
        if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
          p.microsoft = { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET };
        return Object.keys(p).length > 0 ? p : undefined;
      })(),
      // Host-based routing sends every project to its own subdomain
      // (acme.example.com, tasks.example.com, …). For the Studio session
      // cookie to survive the hop from `studio.example.com` into the
      // project subdomain we have to opt in to better-auth's
      // cross-subdomain cookie mode and scope the cookie to the parent
      // domain (e.g. `.example.com`). Configured via env so the same
      // image works locally (cookie stays host-only) and in prod.
      advanced: process.env.OBJECTSTACK_COOKIE_DOMAIN
        ? ({
            crossSubDomainCookies: {
              enabled: true,
              domain: process.env.OBJECTSTACK_COOKIE_DOMAIN,
            },
            useSecureCookies: process.env.NODE_ENV === 'production',
          } as any)
        : undefined,
    }),
    new SecurityPlugin(),
    new AuditPlugin(),
    new MetadataPlugin({ watch: false }),
  ];
}
