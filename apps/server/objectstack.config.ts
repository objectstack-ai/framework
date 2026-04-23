// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Single-Kernel Server Configuration
 *
 * Used only by the legacy **single** bootstrap shape (no env flags set).
 * In multi-project modes — whether local (`OBJECTSTACK_MULTI_PROJECT=true`)
 * or remote (`OBJECTSTACK_CONTROL_PLANE_URL=...`) — the plugin list here is
 * ignored: the control plane uses `createControlPlanePlugins()` and each
 * project kernel is assembled by `DefaultProjectKernelFactory` from the
 * base-plugin factory wired in `bootstrap.ts`.
 *
 * See `server/bootstrap.ts` for shape selection logic.
 */

import { defineStack } from '@objectstack/spec';
import { DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { TursoDriver } from '@objectstack/driver-turso';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { SecurityPlugin } from '@objectstack/plugin-security';
import { AuditPlugin } from '@objectstack/plugin-audit';
import { SetupPlugin } from '@objectstack/plugin-setup';
import { FeedServicePlugin } from '@objectstack/service-feed';
import { MetadataPlugin } from '@objectstack/metadata';
import { AIServicePlugin } from '@objectstack/service-ai';
import { AutomationServicePlugin } from '@objectstack/service-automation';
import { AnalyticsServicePlugin } from '@objectstack/service-analytics';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Resolve base URL: explicit env > Vercel production URL > Vercel preview URL > localhost
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
  ?? (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}` : undefined)
  ?? 'http://localhost:3000';

// Turso driver for sys namespace — remote when env vars are configured, local SQLite otherwise
const __dirname = dirname(fileURLToPath(import.meta.url));
const tursoDriver = new TursoDriver(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: `file:${resolve(__dirname, '.objectstack/data/dev.db')}` },
);

// Datasource routing: default → memory for self-hosted data plane.
// sys_* namespaces are handled by the control-plane preset in multi-project
// shapes; in single-kernel mode the tenant/auth tables are bootstrapped via
// turso when TURSO_DATABASE_URL is configured.
const datasourceMapping = process.env.TURSO_DATABASE_URL
  ? [
      { namespace: 'sys', datasource: 'com.objectstack.driver.turso' },
      { default: true, datasource: 'com.objectstack.driver.memory' },
    ]
  : [
      { default: true, datasource: 'com.objectstack.driver.memory' },
    ];

const oqlPlugin = new ObjectQLPlugin();

export default defineStack({
  manifest: {
    id: 'com.objectstack.server',
    namespace: 'server',
    name: 'ObjectStack Server',
    version: '1.0.0',
    description: 'Production server — multi-project control plane',
    type: 'app',
  },
  // Phase 3: enable project-scoped URLs (/api/v1/projects/:projectId/...)
  // under 'auto' resolution so legacy unscoped routes continue to work.
  api: {
    enableProjectScoping: true,
    projectResolution: 'auto',
  },
  plugins: [
    oqlPlugin,
    // Set datasourceMapping right after ObjectQL init — access ql instance directly
    {
      name: 'datasource-mapping',
      init() {
        const ql = (oqlPlugin as any).ql;
        if (ql?.setDatasourceMapping) ql.setDatasourceMapping(datasourceMapping);
      },
    },
    new DriverPlugin(new InMemoryDriver(), 'memory'),
    new DriverPlugin(tursoDriver, 'turso'),
    new SetupPlugin(),
    new AuthPlugin({
      secret: process.env.AUTH_SECRET ?? 'dev-secret-please-change-in-production-min-32-chars',
      baseUrl,
      plugins: { organization: true },
    }),
    new SecurityPlugin(),
    new AuditPlugin(),
    new FeedServicePlugin(),
    new MetadataPlugin({ watch: false }),
    new AIServicePlugin(),
    new AutomationServicePlugin(),
    new AnalyticsServicePlugin(),
  ],
  datasourceMapping,
}, { strict: false });
