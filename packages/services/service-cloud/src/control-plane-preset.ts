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

/**
 * Create a lazy-proxy plugin that defers its import to init().
 *
 * `startupTimeout` is set on the **wrapper** (not the inner plugin) so the
 * kernel honours it during Phase 2 start. The kernel reads
 * `plugin.startupTimeout` from the registered plugin object, but the inner
 * implementation is not constructed until init() — by which time the
 * registration is already locked in. Without forwarding the budget on the
 * wrapper, heavy plugins like `ObjectQLPlugin` (which does N×CREATE TABLE
 * round-trips against a remote DB) inherit the kernel's default 30s and
 * time out on cold Neon/Turso boots.
 */
function lazyPlugin(name: string, factory: (ctx: any) => Promise<any>, opts?: { startupTimeout?: number }): any {
  let impl: any = null;
  const wrapper: any = {
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
  if (typeof opts?.startupTimeout === 'number' && opts.startupTimeout > 0) {
    wrapper.startupTimeout = opts.startupTimeout;
  }
  return wrapper;
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
    // Migration mode (`OS_MIGRATE_AND_EXIT=1`) gets a 10-minute startup
    // budget because schema sync from a developer laptop to a remote DB
    // can be much slower than from a colocated container. Without this,
    // operators in latency-disadvantaged regions (e.g. Asia → Neon US East
    // at ~300ms RTT × 30 tables × 2 phases) hit the 120s kernel ceiling
    // before all DDL completes. Production cold-boot still uses 120s.
    lazyPlugin('com.objectstack.engine.objectql', async () => {
      const { ObjectQLPlugin } = await import('@objectstack/objectql');
      const plugin = new ObjectQLPlugin();
      oqlRef.ql = (plugin as any).ql ?? plugin;
      return plugin;
    }, {
      startupTimeout:
        process.env.OS_MIGRATE_AND_EXIT === '1' ? 600_000 : 120_000,
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

      // ── Trusted origins (CSRF allow-list for better-auth) ────────────
      // better-auth rejects any request whose Origin header is not in this
      // list with `ERROR: Invalid origin`. Build it from:
      //   1. explicit `OS_TRUSTED_ORIGINS` (comma-separated)
      //   2. the configured baseUrl's origin (so first-party redirects work)
      //   3. preview-mode wildcards (`<commit>--<pid>.<base>`)
      //   4. `http://localhost:*` in dev
      // Keep this in sync with the dev-mode logic in
      // `packages/cli/src/commands/serve.ts` (auto-AuthPlugin block).
      const trustedOrigins: string[] = [];
      const explicitTrusted = process.env.OS_TRUSTED_ORIGINS?.trim();
      if (explicitTrusted) {
        for (const o of explicitTrusted.split(',').map(s => s.trim()).filter(Boolean)) {
          if (!trustedOrigins.includes(o)) trustedOrigins.push(o);
        }
      }
      try {
        const u = new URL(cfg.baseUrl);
        const baseOrigin = `${u.protocol}//${u.host}`;
        if (!trustedOrigins.includes(baseOrigin)) trustedOrigins.push(baseOrigin);
      } catch { /* ignore malformed baseUrl */ }
      const previewMode = (process.env.OS_PREVIEW_MODE ?? '').trim().toLowerCase();
      const isPreviewMode = previewMode === '1' || previewMode === 'true' || previewMode === 'yes';
      if (isPreviewMode) {
        const baseDomains = (process.env.OS_PREVIEW_BASE_DOMAINS
          ?? 'preview.objectstack.ai,localhost')
          .split(',').map(s => s.trim()).filter(Boolean);
        for (const dom of baseDomains) {
          const isLoopback = dom === 'localhost' || dom.endsWith('.localhost');
          const scheme = isLoopback ? 'http' : 'https';
          const portSuffix = isLoopback ? ':*' : '';
          const wildcard = `${scheme}://*.${dom}${portSuffix}`;
          if (!trustedOrigins.includes(wildcard)) trustedOrigins.push(wildcard);
        }
      }
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev && !trustedOrigins.includes('http://localhost:*')) {
        trustedOrigins.push('http://localhost:*');
      }
      // Per-project subdomains: when OS_ROOT_DOMAIN is set (multi-project
      // hosting under `*.<root>`), every project hostname must be trusted
      // by better-auth or sign-up/sign-in / cookie operations are blocked
      // with "Invalid origin". The wildcard mirrors the OS_COOKIE_DOMAIN
      // semantics — they are always set together.
      const rootDomain = (process.env.OS_ROOT_DOMAIN ?? process.env.ROOT_DOMAIN)?.trim();
      if (rootDomain) {
        const wildcard = `https://*.${rootDomain}`;
        if (!trustedOrigins.includes(wildcard)) trustedOrigins.push(wildcard);
      }

      return new AuthPlugin({
        secret: cfg.authSecret,
        baseUrl: cfg.baseUrl,
        plugins: (cfg.authPlugins ?? { organization: true, oidcProvider: true, deviceAuthorization: true }) as any,
        socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
        trustedOrigins: trustedOrigins.length ? trustedOrigins : undefined,
        advanced: process.env.OS_COOKIE_DOMAIN
          ? ({
              crossSubDomainCookies: {
                enabled: true,
                domain: process.env.OS_COOKIE_DOMAIN,
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

    // ── 7. Platform SSO backfill ─────────────────────────────────────────
    // Ensure every pre-existing `sys_project` has a matching
    // `sys_oauth_application` row so per-project deployments can
    // authenticate against this cloud as a unified IdP. Brand-new
    // projects get seeded inline by the dispatcher's POST /cloud/projects
    // handler; this backfill exists to retro-fit anything created before
    // the feature shipped. Runs once per boot, after the auth plugin (so
    // `sys_oauth_application` is registered) and after ObjectQL is ready.
    lazyPlugin('com.objectstack.platform-sso-backfill', async () => ({
      name: 'com.objectstack.platform-sso-backfill',
      version: '1.0.0',
      async start(ctx: any) {
        // Backfill iterates all sys_project rows (up to 1000) doing 2-3
        // DB calls each. On Neon-over-Workers that easily exceeds the
        // 30s plugin-start timeout and rolls back the whole boot, taking
        // the cloud container down with it. The backfill is non-critical
        // (project-create hook seeds the happy path inline); run it in
        // the background so a slow scan never blocks startup.
        const runBackfill = async () => {
          try {
            const baseSecret = (process.env.OS_AUTH_SECRET ?? process.env.AUTH_SECRET ?? cfg.authSecret ?? '').trim();
            if (!baseSecret) {
              ctx.logger?.warn?.('[platform-sso-backfill] OS_AUTH_SECRET missing — skipping');
              return;
            }
            const ql = ctx.getService?.('objectql');
            if (!ql) {
              ctx.logger?.warn?.('[platform-sso-backfill] objectql service not available — skipping');
              return;
            }
            const { backfillPlatformSsoClients } = await import('@objectstack/runtime');
            const result = await backfillPlatformSsoClients({ ql, baseSecret, logger: ctx.logger });
            ctx.logger?.info?.('[platform-sso-backfill] done', result);
          } catch (err) {
            ctx.logger?.warn?.('[platform-sso-backfill] failed (non-fatal)', {
              error: (err as Error)?.message,
            });
          }
        };
        // Fire-and-forget. Attach a noop catch so an unhandled rejection
        // never tips the process over.
        void runBackfill().catch(() => {});
      },
    })),
  ];
}
