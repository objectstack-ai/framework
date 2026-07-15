// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import { createHash } from 'node:crypto';
import { checkProtocolCompat } from '@objectstack/metadata-core';
import type { ObjectStackManifest } from '@objectstack/spec/kernel';
import type { IDataEngine } from '@objectstack/spec/contracts';

export interface PackageMetadata {
  objects?: any[];
  views?: any[];
  apps?: any[];
  flows?: any[];
  agents?: any[];
  tools?: any[];
  translations?: any[];
}

export interface PackageRecord {
  id: string;
  version: string;
  manifest: ObjectStackManifest;
  metadata: PackageMetadata;
  hash: string;
  created_at: string;
  updated_at: string;
}

export interface PackageService {
  publish(data: { manifest: ObjectStackManifest; metadata: PackageMetadata }): Promise<{ success: boolean; error?: string }>;
  get(packageId: string, version?: string): Promise<PackageRecord | null>;
  list(): Promise<PackageRecord[]>;
  delete(packageId: string, version?: string): Promise<{ success: boolean }>;
}

/**
 * Normalize the result of `objectql.execute()` into a row array.
 *
 * Different drivers return different shapes for raw SELECT statements:
 *   - SQL driver (knex/SQLite) and Turso remote transport return rows
 *     directly as an array.
 *   - PostgreSQL (knex/pg) returns `{ rows, rowCount, ... }`.
 *   - Some drivers may return `{ rows: [...] }` wrappers in other contexts.
 *
 * This helper accepts any of those shapes and always returns an array.
 */
function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Package Management Service Plugin
 *
 * Provides package publishing, retrieval, and management capabilities.
 * Stores package metadata in the sys.packages table for dynamic loading.
 */
export class PackageServicePlugin implements Plugin {
  name = 'package-service';

  async init(ctx: PluginContext): Promise<void> {
    // Service will be registered in start() after ObjectQL is available
    ctx.logger.debug('Package service plugin initialized');
  }

  async start(ctx: PluginContext): Promise<void> {
    const logger = ctx.logger;

    // Get ObjectQL service (available in start() hook after dependencies are initialized)
    const objectql = ctx.getService<IDataEngine>('objectql');
    if (!objectql || !objectql.execute) {
      throw new Error('ObjectQL service with execute() support is required for PackageService');
    }

    // Create sys_packages table if it doesn't exist
    try {
      await this.ensureTable(objectql, logger);
    } catch (error) {
      logger.error('Failed to create sys_packages table', error as Error);
      throw error;
    }

    // Create the package service
    const packageService: PackageService = {
      async publish(data: { manifest: ObjectStackManifest; metadata: PackageMetadata }) {
        try {
          const hash = createHash('sha256')
            .update(JSON.stringify({ manifest: data.manifest, metadata: data.metadata }))
            .digest('hex');

          await objectql.execute!({
            sql: `
              INSERT INTO sys_packages (id, version, manifest, metadata, hash, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              ON CONFLICT(id, version) DO UPDATE SET
                manifest = excluded.manifest,
                metadata = excluded.metadata,
                hash = excluded.hash,
                updated_at = CURRENT_TIMESTAMP
            `,
            args: [
              data.manifest.id,
              data.manifest.version,
              JSON.stringify(data.manifest),
              JSON.stringify(data.metadata),
              hash,
            ],
          });

          logger.info(`Published package: ${data.manifest.id}@${data.manifest.version}`);
          return { success: true };
        } catch (error) {
          logger.error('Failed to publish package', error as Error);
          return {
            success: false,
            error: (error as Error).message,
          };
        }
      },

      async get(packageId: string, version: string = 'latest') {
        try {
          const sql = version === 'latest'
            ? `SELECT * FROM sys_packages WHERE id = ? ORDER BY created_at DESC LIMIT 1`
            : `SELECT * FROM sys_packages WHERE id = ? AND version = ?`;

          const args = version === 'latest' ? [packageId] : [packageId, version];
          const result = await objectql.execute!({ sql, args });
          const rows = normalizeRows(result);

          if (rows.length === 0) {
            return null;
          }

          const row = rows[0];
          return {
            id: row.id,
            version: row.version,
            manifest: JSON.parse(row.manifest),
            metadata: JSON.parse(row.metadata),
            hash: row.hash,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        } catch (error) {
          logger.error(`Failed to get package: ${packageId}`, error as Error);
          return null;
        }
      },

      async list() {
        try {
          const result = await objectql.execute!({
            sql: `
              SELECT * FROM sys_packages
              WHERE (id, created_at) IN (
                SELECT id, MAX(created_at) FROM sys_packages GROUP BY id
              )
              ORDER BY created_at DESC
            `,
          });

          return normalizeRows(result).map((row: any) => ({
            id: row.id,
            version: row.version,
            manifest: JSON.parse(row.manifest),
            metadata: JSON.parse(row.metadata),
            hash: row.hash,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));
        } catch (error) {
          logger.error('Failed to list packages', error as Error);
          return [];
        }
      },

      async delete(packageId: string, version?: string) {
        try {
          const sql = version
            ? `DELETE FROM sys_packages WHERE id = ? AND version = ?`
            : `DELETE FROM sys_packages WHERE id = ?`;

          const args = version ? [packageId, version] : [packageId];
          await objectql.execute!({ sql, args });

          logger.info(`Deleted package: ${packageId}${version ? `@${version}` : ''}`);
          return { success: true };
        } catch (error) {
          logger.error('Failed to delete package', error as Error);
          return { success: false };
        }
      },
    };

    ctx.registerService('package', packageService);
    logger.info('Package service initialized');

    // Reconcile durable packages back into the in-memory registry (ADR-0033
    // consolidation). Packages persisted to `sys_packages` — AI-authored app
    // packages, or anything HTTP-installed in a previous run — must survive a
    // restart and surface in the registry-backed read paths (the dispatcher's
    // `/api/v1/packages` list/detail and `getMetaItems({type:'package'})`, i.e.
    // Studio's package selector). Never clobber a package already registered
    // from the filesystem. Best-effort and non-fatal.
    try {
      const registry = (objectql as unknown as { registry?: any }).registry;
      if (registry?.installPackage && registry?.getPackage) {
        let hydrated = 0;
        for (const rec of await packageService.list()) {
          const id = rec?.manifest?.id;
          if (id && !registry.getPackage(id)) {
            // ADR-0087 D1 — protocol handshake on the boot-time rehydration
            // path (the LOAD seam; the install seam already checks in
            // metadata-protocol). A durable package persisted under an older
            // runtime whose declared `engines.protocol` excludes this runtime's
            // major is REFUSED here with the structured diagnostic — skipped,
            // never loaded — instead of resurfacing later as a deep schema or
            // renderer crash. Boot itself continues: one stale package must not
            // brick the environment. Absent/unparsable ranges are admitted
            // (grandfathering; never a false rejection).
            const compat = checkProtocolCompat(rec.manifest);
            if (compat.status === 'incompatible') {
              logger.error(
                `[protocol] refusing to rehydrate package '${id}' from sys_packages: ` +
                  `${compat.diagnostic.message} ` +
                  JSON.stringify(compat.diagnostic),
              );
              continue;
            }
            if (compat.status === 'no-range') {
              logger.warn(
                `[protocol] package '${id}' declares no engines.protocol range; ` +
                  `rehydrating without a compatibility check (ADR-0087).`,
              );
            } else if (compat.status === 'unparsed-range') {
              logger.warn(
                `[protocol] package '${id}' declares an unrecognized ${compat.source} range ` +
                  `'${compat.requiredRange}'; skipping the protocol handshake (ADR-0087).`,
              );
            }
            registry.installPackage(rec.manifest);
            hydrated++;
          }
        }
        if (hydrated > 0) {
          logger.info(`Hydrated ${hydrated} package(s) from sys_packages into registry`);
        }
      }
    } catch (error) {
      logger.debug(`Package hydration from sys_packages skipped: ${(error as Error)?.message}`);
    }
  }

  private async ensureTable(objectql: IDataEngine, logger: any): Promise<void> {
    try {
      // Create the sys_packages table
      await objectql.execute!({
        sql: `
          CREATE TABLE IF NOT EXISTS sys_packages (
            id TEXT NOT NULL,
            version TEXT NOT NULL,
            manifest TEXT NOT NULL,
            metadata TEXT NOT NULL,
            hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id, version)
          )
        `,
      });

      // Create index for faster latest version queries
      await objectql.execute!({
        sql: `
          CREATE INDEX IF NOT EXISTS idx_packages_latest
          ON sys_packages(id, created_at DESC)
        `,
      });

      logger.debug('sys_packages table ensured');
    } catch (error) {
      // Table might already exist, log and continue
      logger.debug('sys_packages table creation skipped (may already exist)');
    }
  }
}

export { PackageServicePlugin as default };
