// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Integration test for EnvironmentProvisioningService + TursoEnvironmentDatabaseAdapter.
 *
 * Requires TURSO_ORG_NAME and TURSO_API_TOKEN — loaded from .env.local if present.
 *
 * Run: pnpm --filter @objectstack/server test:provisioning
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Load .env.local
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envLocalPath = resolve(__dirname, '../.env.local');
try {
  const lines = readFileSync(envLocalPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env.local absent — rely on environment variables already being set
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function ok(label: string) {
  console.log(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
// Test: TursoEnvironmentDatabaseAdapter
// ---------------------------------------------------------------------------

import {
  TursoEnvironmentDatabaseAdapter,
  createDefaultEnvironmentAdapters,
  EnvironmentProvisioningService,
} from '@objectstack/service-tenant';
import { TursoPlatformClient } from '@objectstack/service-tenant';

const orgName = process.env.TURSO_ORG_NAME;
const apiToken = process.env.TURSO_API_TOKEN;

if (!orgName || !apiToken) {
  console.error('SKIP: TURSO_ORG_NAME and TURSO_API_TOKEN must be set.');
  process.exit(0);
}

console.log('\n── Environment Provisioning Integration Test ──\n');
console.log(`  org: ${orgName}`);

const createdDbs: string[] = [];

async function cleanup(client: TursoPlatformClient) {
  for (const name of createdDbs) {
    try {
      await client.deleteDatabase(name);
      console.log(`  🗑  cleaned up: ${name}`);
    } catch (e) {
      console.warn(`  ⚠  failed to delete ${name}:`, (e as Error).message);
    }
  }
}

async function run() {
  const client = new TursoPlatformClient({ apiToken: apiToken!, organization: orgName! });
  const adapter = new TursoEnvironmentDatabaseAdapter({ apiToken: apiToken!, organization: orgName! });

  // ── Test 1: createDefaultEnvironmentAdapters picks Turso when TURSO_ORG_NAME is set
  {
    const adapters = createDefaultEnvironmentAdapters();
    assert(adapters.length === 1, 'should return exactly one adapter');
    assert(adapters[0].driver === 'turso', `expected driver=turso, got ${adapters[0].driver}`);
    ok('createDefaultEnvironmentAdapters → TursoEnvironmentDatabaseAdapter');
  }

  // ── Test 2: TursoEnvironmentDatabaseAdapter.createDatabase
  let databaseUrl = '';
  let plaintextSecret = '';
  let databaseName = '';
  {
    const envId = `test-${Date.now()}`;
    databaseName = `env-${envId}`;
    createdDbs.push(databaseName);

    const result = await adapter.createDatabase({
      environmentId: envId,
      databaseName,
      region: 'us-east-1',
      storageLimitMb: 256,
    });

    assert(result.databaseUrl.startsWith('libsql://'), `expected libsql:// URL, got: ${result.databaseUrl}`);
    assert(result.plaintextSecret.length > 0, 'expected non-empty JWT token');
    ok(`createDatabase → ${result.databaseUrl}`);

    databaseUrl = result.databaseUrl;
    plaintextSecret = result.plaintextSecret;
  }

  // ── Test 3: EnvironmentProvisioningService.provisionEnvironment end-to-end
  {
    const svc = new EnvironmentProvisioningService({
      adapters: [adapter],
      defaultDriver: 'turso',
    });

    const dbName2 = `env-svc-${Date.now()}`;
    createdDbs.push(dbName2);

    const result = await svc.provisionEnvironment({
      organizationId: 'org-integration-test',
      slug: 'test-env',
      envType: 'test',
      createdBy: 'integration-test',
      driver: 'turso',
    });

    assert(result.environment.databaseUrl.startsWith('libsql://'), 'environment URL must be libsql://');
    assert(result.environment.databaseDriver === 'turso', 'driver must be turso');
    assert(result.credential.secretCiphertext.length > 0, 'credential must have ciphertext');
    ok(`provisionEnvironment → ${result.environment.databaseUrl}`);

    // Track the actual db name for cleanup
    const hostname = result.environment.databaseUrl.replace('libsql://', '');
    const actualDbName = hostname.split('.')[0];
    if (!createdDbs.includes(actualDbName)) createdDbs.push(actualDbName);
  }

  await cleanup(client);
  console.log('\n✅ All integration tests passed.\n');
}

run().catch(async (err) => {
  const client = new TursoPlatformClient({ apiToken: apiToken!, organization: orgName! });
  await cleanup(client);
  console.error('\n❌', err.message);
  process.exit(1);
});
