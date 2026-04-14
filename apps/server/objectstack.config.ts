// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { TursoDriver } from '@objectstack/driver-turso';
import { AuthPlugin } from '@objectstack/plugin-auth';
import CrmApp from '../../examples/app-crm/objectstack.config';
import TodoApp from '../../examples/app-todo/objectstack.config';
import BiPluginManifest from '../../examples/plugin-bi/objectstack.config';

// Production Server
// This project acts as a "Platform Server" that loads multiple apps and plugins.
// It effectively replaces the manual composition in `src/index.ts`.

// Shared authentication plugin — reads secrets from environment variables so the
// same config works both locally and on Vercel (where VERCEL_URL is injected).
const authPlugin = new AuthPlugin({
  secret: process.env.AUTH_SECRET ?? 'dev-secret-please-change-in-production-min-32-chars',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'),
});

export default defineStack({
  manifest: {
    id: 'com.objectstack.server',
    namespace: 'server',
    name: 'ObjectStack Server',
    version: '1.0.0',
    description: 'Production server aggregating CRM, Todo and BI plugins',
    type: 'app',
  },

  // Datasource Mapping Configuration
  // Routes different namespaces to different datasources for optimal performance
  datasourceMapping: [
    // Example apps use in-memory driver for fast, ephemeral data
    { namespace: 'crm', datasource: 'memory' },
    { namespace: 'todo', datasource: 'memory' },
    { namespace: 'bi', datasource: 'memory' },
    // System objects use Turso for persistent, production-grade storage
    { namespace: 'sys', datasource: 'turso' },
    // Default fallback to memory driver
    { default: true, datasource: 'memory' },
  ],

  // Explicitly Load Plugins and Apps
  // The Runtime CLI will iterate this list and call kernel.use()
  plugins: [
    new ObjectQLPlugin(),
    // Register Memory Driver for example apps (volatile, fast)
    new DriverPlugin(new InMemoryDriver(), { name: 'memory' }),
    // Register Turso Driver for system objects (persistent, production)
    new DriverPlugin(
      new TursoDriver({
        url: process.env.TURSO_DATABASE_URL ?? 'file:./data/server.db',
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
      { name: 'turso' }
    ),
    // Authentication — required for production (Vercel) deployments
    authPlugin,
    // Wrap Manifests/Stacks in AppPlugin adapter
    new AppPlugin(CrmApp),
    new AppPlugin(TodoApp),
    new AppPlugin(BiPluginManifest)
  ]
});

/**
 * Preview Mode Host Example
 *
 * Demonstrates how to run the platform in "preview" mode.
 * When `mode` is set to `'preview'`, the kernel signals the frontend to:
 * - Skip login/registration screens
 * - Automatically simulate an admin identity
 * - Display a preview-mode banner to the user
 *
 * Use this for marketplace demos, app showcases, or onboarding
 * tours where visitors should explore the system without signing up.
 *
 * ## Usage
 *
 * Set the `OS_MODE` environment variable to `preview` at boot:
 *
 * ```bash
 * OS_MODE=preview pnpm dev
 * ```
 *
 * Or use this stack definition directly as a starting point.
 *
 * ## KernelContext (created by the Runtime at boot)
 *
 * ```ts
 * import { KernelContextSchema } from '@objectstack/spec/kernel';
 *
 * const ctx = KernelContextSchema.parse({
 *   instanceId: '550e8400-e29b-41d4-a716-446655440000',
 *   mode: 'preview',
 *   version: '1.0.0',
 *   cwd: process.cwd(),
 *   startTime: Date.now(),
 *   previewMode: {
 *     autoLogin: true,
 *     simulatedRole: 'admin',
 *     simulatedUserName: 'Demo Admin',
 *     readOnly: false,
 *     bannerMessage: 'You are exploring a demo — data will be reset periodically.',
 *   },
 * });
 * ```
 */
export const PreviewHostExample = defineStack({
  manifest: {
    id: 'com.objectstack.server-preview',
    namespace: 'server',
    name: 'ObjectStack Server Preview',
    version: '1.0.0',
    description: 'Production server in preview/demo mode — bypasses login, simulates admin user',
    type: 'app',
  },

  // Same datasource mapping as standard server
  datasourceMapping: [
    { namespace: 'crm', datasource: 'memory' },
    { namespace: 'todo', datasource: 'memory' },
    { namespace: 'bi', datasource: 'memory' },
    { namespace: 'sys', datasource: 'turso' },
    { default: true, datasource: 'memory' },
  ],

  // Same plugins as the standard host
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver(), { name: 'memory' }),
    new DriverPlugin(
      new TursoDriver({
        url: process.env.TURSO_DATABASE_URL ?? 'file:./data/server.db',
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
      { name: 'turso' }
    ),
    authPlugin,
    new AppPlugin(CrmApp),
    new AppPlugin(TodoApp),
    new AppPlugin(BiPluginManifest)
  ]
});
