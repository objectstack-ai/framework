// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/driver-turso
 *
 * Turso/libSQL driver for ObjectStack — edge-first, globally distributed
 * SQLite with embedded replicas and database-per-tenant multi-tenancy.
 *
 * Extends `@objectstack/driver-sql` (SqlDriver) and inherits all CRUD,
 * schema management, filtering, aggregation, and introspection logic.
 * Only Turso-specific features (connection modes, sync, multi-tenant)
 * are implemented here — zero duplicated query/schema code.
 *
 * Supports three connection modes:
 * 1. Local (Embedded): `url: 'file:./data/local.db'`
 * 2. In-Memory (Testing): `url: ':memory:'`
 * 3. Embedded Replica (Hybrid): `url` + `syncUrl`
 *
 * @example
 * ```typescript
 * import { TursoDriver } from '@objectstack/driver-turso';
 *
 * const driver = new TursoDriver({
 *   url: 'file:./data/app.db',
 * });
 * await driver.connect();
 * ```
 */

import { TursoDriver } from './turso-driver.js';

export { TursoDriver, type TursoDriverConfig } from './turso-driver.js';

export {
  createMultiTenantRouter,
  type MultiTenantConfig,
  type MultiTenantRouter,
} from './multi-tenant.js';

/**
 * Factory function to create a TursoDriver instance.
 *
 * @param config - Turso driver configuration
 * @returns A new TursoDriver instance (not yet connected)
 *
 * @example
 * ```typescript
 * import { createTursoDriver } from '@objectstack/driver-turso';
 *
 * // Local file
 * const driver = createTursoDriver({ url: 'file:./data/app.db' });
 *
 * // In-memory (testing)
 * const driver = createTursoDriver({ url: ':memory:' });
 *
 * // Embedded replica
 * const driver = createTursoDriver({
 *   url: 'file:./data/replica.db',
 *   syncUrl: 'libsql://my-db-orgname.turso.io',
 *   authToken: process.env.TURSO_AUTH_TOKEN,
 *   sync: { intervalSeconds: 60, onConnect: true },
 * });
 *
 * await driver.connect();
 * ```
 */
export function createTursoDriver(config: import('./turso-driver.js').TursoDriverConfig): TursoDriver {
  return new TursoDriver(config);
}

export default {
  id: 'com.objectstack.driver.turso',
  version: '1.0.0',

  onEnable: async (context: any) => {
    const { logger, config, drivers } = context;
    logger.info('[Turso Driver] Initializing...');

    if (drivers) {
      const driver = new TursoDriver(config);
      drivers.register(driver);
      logger.info(`[Turso Driver] Registered driver: ${driver.name}`);
    } else {
      logger.warn('[Turso Driver] No driver registry found in context.');
    }
  },
};
