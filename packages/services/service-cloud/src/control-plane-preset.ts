// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Control-Plane Plugin Preset
 *
 * All heavy plugin packages (better-auth, security, audit, metadata …) are
 * loaded via dynamic import() inside init() so that bundleRequire/esbuild
 * does NOT inline them at parse time. This keeps startup RSS below 200 MB.
 *
 * Each entry is a lazy-proxy plugin: init() dynamically imports the real
 * package, constructs it, and delegates all subsequent lifecycle hooks
 * (start, stop) to the real instance stored on `_impl`.
 */

import type * as Contracts from '@objectstack/spec/contracts';

export interface ControlPlanePresetConfig {
  /** Promise resolving to the control-plane driver. Accepted as a Promise so
   *  the caller can defer the heavy DB library import until plugin init time. */
  controlDriverPromise: Promise<{
    driver: Contracts.IDataDriver;
    driverName: string;
    databaseUrl: string;
  }>;
  authSecret: string;
  baseUrl: string;
  registerSystemObjects?: boolean;
  authPlugins?: Record<string, unknown>;
}

/** Create a lazy-proxy plugin that defers its import to init(). */
function lazyPlugin(name: string, factory: (ctx: any) => Promise<any>): any {
  let impl: any = null;
  return {
    name,
    async init(ctx: any) {
      impl = await factory(ctx);
      if (impl?.init) await impl.init(ctx);
    },
    async start(ctx: any) {
      if (impl?.start) await impl.start(ctx);
    },
    async stop(ctx: any) {
      if (impl?.stop) await impl.stop(ctx);
    },
  };
}

/**
 * Build the ordered plugin list that powers the control plane.
 *
 * Ordering:
 *  1. ObjectQL — schema registry
 *  2. Datasource mapping — wires single driver to ObjectQL
 *  3. Driver — control-plane database
 *  4. PackageService, Tenant, SystemProject — sys_* objects
 *  5. Auth, Security, Audit — authentication + RBAC
 *  6. Metadata — file-system schema snapshots
 */
export function createControlPlanePlugins(cfg: ControlPlanePresetConfig): any[] {
  // Shared ref so ObjectQL proxy can expose its instance to the datasource-mapping plugin.
  const oqlRef: { ql: any } = { ql: null };
  // Driver info resolved lazily; both datasource-mapping and Driver proxy read from here.
  const driverRef: { driverName: string; driver: any; databaseUrl: string } = {
    driverName: '', driver: null, databaseUrl: '',
  };

  return [
    // ── 1. ObjectQL ────────────────────────────────────────────────────────
    lazyPlugin('com.objectstack.engine.objectql', async () => {
      const { ObjectQLPlugin } = await import('@objectstack/objectql');
      const plugin = new ObjectQLPlugin();
      oqlRef.ql = (plugin as any).ql ?? plugin;
      return plugin;
    }),

    // ── 2. Datasource mapping (no heavy deps) ─────────────────────────────
    //   Runs after Driver (step 3) because kernel calls init() in registration order.
    //   We defer the actual mapping until after driverRef is populated.
    {
      name: 'control-plane-datasource-mapping',
      async init() {
        // Resolve driver info if not yet done (may have been done by step 3 already).
        if (!driverRef.driverName) {
          const resolved = await cfg.controlDriverPromise;
          Object.assign(driverRef, resolved);
        }
        const ql = oqlRef.ql;
        if (ql?.setDatasourceMapping) {
          ql.setDatasourceMapping([
            { default: true, datasource: `com.objectstack.driver.${driverRef.driverName}` },
          ]);
        }
      },
    },

    // ── 3. Driver ──────────────────────────────────────────────────────────
    {
      name: 'com.objectstack.driver',
      version: '0.0.0',
      async init(ctx: any) {
        const resolved = await cfg.controlDriverPromise;
        Object.assign(driverRef, resolved);
        console.log(`[Bootstrap] Control DB: ${driverRef.databaseUrl} (${driverRef.driverName})`);
        const { DriverPlugin } = await import('@objectstack/runtime');
        const plugin = new DriverPlugin(driverRef.driver, driverRef.driverName);
        // Patch the name so kernel registers it under the correct driver id
        (this as any)._driverPlugin = plugin;
        if (plugin.init) await plugin.init(ctx);
      },
      async start(ctx: any) {
        if ((this as any)._driverPlugin?.start) await (this as any)._driverPlugin.start(ctx);
      },
      async stop(ctx: any) {
        if ((this as any)._driverPlugin?.stop) await (this as any)._driverPlugin.stop(ctx);
      },
    },

    // ── 4a. PackageService ────────────────────────────────────────────────
    lazyPlugin('com.objectstack.service.package', async () => {
      const { PackageServicePlugin } = await import('@objectstack/service-package');
      return new PackageServicePlugin();
    }),

    // ── 4b. Tenant ────────────────────────────────────────────────────────
    lazyPlugin('com.objectstack.service.tenant', async () => {
      const { createTenantPlugin } = await import('@objectstack/service-tenant');
      return createTenantPlugin({
        registerSystemObjects: cfg.registerSystemObjects ?? true,
      });
    }),

    // ── 4c. SystemProject ─────────────────────────────────────────────────
    lazyPlugin('com.objectstack.system-project', async () => {
      const { createSystemProjectPlugin } = await import('@objectstack/runtime');
      return createSystemProjectPlugin();
    }),

    // ── 5a. Auth (heavy: better-auth + all plugins) ───────────────────────
    lazyPlugin('com.objectstack.auth', async () => {
      const { AuthPlugin } = await import('@objectstack/plugin-auth');
      const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
        socialProviders.google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
      if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
        socialProviders.github = { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET };
      if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
        socialProviders.microsoft = { clientId: process.env.MICROSOFT_CLIENT_ID, clientSecret: process.env.MICROSOFT_CLIENT_SECRET };

      return new AuthPlugin({
        secret: cfg.authSecret,
        baseUrl: cfg.baseUrl,
        plugins: (cfg.authPlugins ?? { organization: true, oidcProvider: true, deviceAuthorization: true }) as any,
        socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
        advanced: process.env.OBJECTSTACK_COOKIE_DOMAIN
          ? ({
              crossSubDomainCookies: {
                enabled: true,
                domain: process.env.OBJECTSTACK_COOKIE_DOMAIN,
              },
              useSecureCookies: process.env.NODE_ENV === 'production',
            } as any)
          : undefined,
      });
    }),

    // ── 5b. Security ──────────────────────────────────────────────────────
    lazyPlugin('com.objectstack.security', async () => {
      const { SecurityPlugin } = await import('@objectstack/plugin-security');
      return new SecurityPlugin();
    }),

    // ── 5c. Audit ─────────────────────────────────────────────────────────
    lazyPlugin('com.objectstack.audit', async () => {
      const { AuditPlugin } = await import('@objectstack/plugin-audit');
      return new AuditPlugin();
    }),

    // ── 6. Metadata ───────────────────────────────────────────────────────
    lazyPlugin('com.objectstack.metadata', async () => {
      const { MetadataPlugin } = await import('@objectstack/metadata');
      return new MetadataPlugin({ watch: false });
    }),
  ];
}
