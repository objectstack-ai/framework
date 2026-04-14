// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { defineStack } from '@objectstack/spec';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { TursoDriver } from '@objectstack/driver-turso';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { AuthPlugin } from '@objectstack/plugin-auth';
import { SecurityPlugin } from '@objectstack/plugin-security';
import { MetadataPlugin } from '@objectstack/metadata';

/**
 * Vercel Deployment Example
 *
 * This example demonstrates how to deploy an ObjectStack server to Vercel
 * using the Hono adapter. It includes:
 *
 * - TursoDriver for production (with fallback to in-memory for local dev)
 * - Authentication with better-auth (environment-based configuration)
 * - Security plugin for RBAC
 * - Metadata plugin for runtime metadata management
 *
 * Environment Variables (set in Vercel dashboard or .env.local):
 * - TURSO_DATABASE_URL: Turso database connection URL (or ":memory:" for local)
 * - TURSO_AUTH_TOKEN: Turso authentication token (optional for local)
 * - AUTH_SECRET: Secret key for authentication (min 32 characters)
 * - VERCEL_URL: Auto-injected by Vercel (deployment URL)
 * - VERCEL_PROJECT_PRODUCTION_URL: Auto-injected by Vercel (production URL)
 */

// Determine if we're running in production (Vercel) or local dev
const isProduction = process.env.VERCEL === '1';

// Database driver: Use Turso in production, in-memory for local dev
const driver = isProduction || process.env.TURSO_DATABASE_URL
  ? new TursoDriver({
      url: process.env.TURSO_DATABASE_URL ?? ':memory:',
      ...(process.env.TURSO_AUTH_TOKEN && { authToken: process.env.TURSO_AUTH_TOKEN }),
    })
  : new InMemoryDriver();

// Base URL for authentication (auto-detected from Vercel environment)
const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

// Collect trusted origins for CORS and CSRF protection
function getVercelOrigins(): string[] {
  const origins: string[] = [];
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  if (process.env.VERCEL_BRANCH_URL) {
    origins.push(`https://${process.env.VERCEL_BRANCH_URL}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return origins;
}

const trustedOrigins = getVercelOrigins();

export default defineStack({
  manifest: {
    id: 'com.example.vercel',
    namespace: 'vercel',
    name: 'Vercel Deployment Example',
    version: '1.0.0',
    description: 'Example application demonstrating Hono deployment to Vercel',
    type: 'app',
  },

  // Core plugins required for a functional ObjectStack server
  plugins: [
    new ObjectQLPlugin(),
    new DriverPlugin(driver),
    new AuthPlugin({
      secret: process.env.AUTH_SECRET ?? 'dev-secret-please-change-in-production-min-32-chars',
      baseUrl,
      ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
    }),
    new SecurityPlugin(),
    new MetadataPlugin({ watch: false }), // Disable file watching on Vercel
  ],
});
