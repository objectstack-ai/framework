// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Migration: ensure overlay-uniqueness index exists on `sys_metadata`.
 *
 * ADR-0005 Phase 1 — Overlay rows must be uniquely keyed by
 * `(type, name, organization_id, environment_id, scope)` for active rows only.
 * The previous `(type, name, environment_id)` unique constraint pre-dated
 * multi-tenant overlays and would incorrectly reject per-org customizations.
 *
 * Behaviour:
 *  - SQLite / Postgres: creates a partial UNIQUE INDEX with `WHERE state = 'active'`.
 *  - MySQL (no partial-index support): falls back to a non-unique composite index
 *    plus an application-level guard (handled in `protocol.ts saveMetaItem`).
 *  - Idempotent — uses `CREATE INDEX IF NOT EXISTS`. Safe to run on every boot.
 *  - Best-effort: failures are recorded but never throw, so tenant boot is
 *    not blocked on a database that doesn't support partial indexes.
 *
 * Usage:
 *   import { addSysMetadataOverlayIndex } from '@objectstack/metadata/migrations';
 *   await addSysMetadataOverlayIndex(driver);
 *
 * The `DatabaseLoader.ensureSchema()` invokes this automatically after the
 * `sys_metadata` table is created/synced, so most callers do not need to
 * invoke it directly.
 */

import type { IDataDriver } from '@objectstack/spec/contracts';

const INDEX_NAME = 'idx_sys_metadata_overlay_active';
const TABLE = 'sys_metadata';
const COLUMNS = '(type, name, organization_id, environment_id, scope)';
const WHERE = "state = 'active'";

export interface AddSysMetadataOverlayIndexResult {
    index: string;
    status: 'created' | 'already_exists' | 'fallback_non_unique' | 'unsupported' | 'error';
    error?: string;
}

/**
 * Ensure the overlay-uniqueness index exists on `sys_metadata`.
 *
 * @param driver  An `IDataDriver` exposing a `raw(sql, bindings?)` method.
 */
export async function addSysMetadataOverlayIndex(
    driver: IDataDriver,
): Promise<AddSysMetadataOverlayIndexResult> {
    const driverAny = driver as any;
    const exec = async (sql: string): Promise<void> => {
        if (typeof driverAny.raw === 'function') {
            await driverAny.raw(sql);
        } else if (typeof driverAny.execute === 'function') {
            await driverAny.execute(sql);
        } else {
            throw new Error('driver has neither raw nor execute');
        }
    };

    const partialSql = `CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME} ON ${TABLE} ${COLUMNS} WHERE ${WHERE}`;
    const fallbackSql = `CREATE INDEX IF NOT EXISTS ${INDEX_NAME} ON ${TABLE} ${COLUMNS}`;

    try {
        await exec(partialSql);
        return { index: INDEX_NAME, status: 'created' };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Partial-index unsupported (typically MySQL): fall back to a plain composite index.
        if (/partial|where clause|syntax/i.test(msg)) {
            try {
                await exec(fallbackSql);
                return { index: INDEX_NAME, status: 'fallback_non_unique' };
            } catch (fallbackErr) {
                return {
                    index: INDEX_NAME,
                    status: 'error',
                    error:
                        fallbackErr instanceof Error
                            ? fallbackErr.message
                            : String(fallbackErr),
                };
            }
        }

        if (/already exists/i.test(msg)) {
            return { index: INDEX_NAME, status: 'already_exists' };
        }

        return { index: INDEX_NAME, status: 'error', error: msg };
    }
}
