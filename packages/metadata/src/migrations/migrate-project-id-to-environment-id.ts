// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Migration: project_id → environment_id
 *
 * Renames the `project_id` column to `environment_id` on the metadata
 * storage tables:
 *   - sys_metadata
 *   - sys_metadata_history
 *
 * Forward counterpart of {@link migrateEnvIdToProjectId} (which performed the
 * earlier `env_id → project_id` rename). Together they let an operator walk an
 * old schema all the way forward in two steps:
 *
 *   migrateEnvIdToProjectId(driver);            // env_id     → project_id    (legacy)
 *   migrateProjectIdToEnvironmentId(driver);    // project_id → environment_id (v5)
 *
 * (The per-type projection tables `sys_object` / `sys_view` / `sys_flow` /
 * `sys_agent` / `sys_tool` were removed in 2026-05 along with the projection
 * pipeline — see ADR 0005 addendum. They are intentionally not included.)
 *
 * Safe to run multiple times (idempotent): checks for column existence before
 * attempting to rename. If `environment_id` already exists, the step is
 * skipped.
 *
 * Usage:
 *   import { migrateProjectIdToEnvironmentId } from '@objectstack/metadata/migrations';
 *   await migrateProjectIdToEnvironmentId(driver);
 */

import type { IDataDriver } from '@objectstack/spec/contracts';

const AFFECTED_TABLES = [
    'sys_metadata',
    'sys_metadata_history',
] as const;

export interface ProjectIdToEnvironmentIdResult {
    table: string;
    status: 'renamed' | 'already_done' | 'table_missing' | 'error';
    error?: string;
}

/**
 * Rename `project_id` → `environment_id` on all metadata tables.
 *
 * @param driver  An IDataDriver with access to the target database.
 *                Must expose a raw query method: `driver.raw(sql, bindings?)`.
 * @returns       Per-table migration results.
 */
export async function migrateProjectIdToEnvironmentId(
    driver: IDataDriver,
): Promise<ProjectIdToEnvironmentIdResult[]> {
    const driverAny = driver as any;

    if (typeof driverAny.raw !== 'function') {
        throw new Error(
            'migrateProjectIdToEnvironmentId: driver must expose a .raw(sql, bindings?) method. ' +
            'SqlDriver (better-sqlite3/knex) and TursoDriver both support this.'
        );
    }

    const results: ProjectIdToEnvironmentIdResult[] = [];

    for (const table of AFFECTED_TABLES) {
        try {
            const hasColumn = await _columnExists(driverAny, table, 'project_id');
            const alreadyMigrated = await _columnExists(driverAny, table, 'environment_id');

            if (alreadyMigrated && !hasColumn) {
                results.push({ table, status: 'already_done' });
                continue;
            }

            if (!hasColumn) {
                results.push({ table, status: 'table_missing' });
                continue;
            }

            await driverAny.raw(
                `ALTER TABLE "${table}" RENAME COLUMN project_id TO environment_id`,
            );

            results.push({ table, status: 'renamed' });
        } catch (err: any) {
            results.push({ table, status: 'error', error: err?.message ?? String(err) });
        }
    }

    return results;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _columnExists(driver: any, table: string, column: string): Promise<boolean> {
    try {
        const rows: any[] = await driver.raw(`PRAGMA table_info("${table}")`);
        if (Array.isArray(rows) && rows.length > 0) {
            const list: any[] = Array.isArray(rows[0]) ? rows[0] : rows;
            return list.some((r: any) => r?.name === column);
        }

        const result: any[] = await driver.raw(
            `SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = ?`,
            [table, column],
        );
        const list: any[] = Array.isArray(result[0]) ? result[0] : result;
        return list.length > 0;
    } catch {
        return false;
    }
}
