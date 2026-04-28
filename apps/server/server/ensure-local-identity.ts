// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Idempotent control-plane seed for **project** mode.
 *
 * In project mode we reuse the cloud (multi-project) plugin stack but back it
 * with two local SQLite files:
 *
 *   - `control.db`     — control plane (sys_organization, sys_project, …)
 *   - `proj_local.db`  — the single project's business database
 *
 * For `KernelManager` (cloud factory) to resolve `proj_local`, the control
 * plane must contain a real `sys_project` row whose `database_url` points at
 * `proj_local.db`. This helper performs that seed idempotently on every
 * boot, so the project-mode code path is identical to cloud after the first
 * request — no synthetic project rows, no special branches in the dispatcher.
 */

export const LOCAL_ORG_ID = 'org_local';
export const LOCAL_PROJECT_ID = 'proj_local';

export interface LocalIdentityOptions {
    /** ObjectQL service handle bound to the control-plane DB. */
    objectql: any;
    /** Override the default `org_local` identifier. */
    orgId?: string;
    /** Override the default `proj_local` identifier. */
    projectId?: string;
    /** Display name for the seeded organization. */
    orgName?: string;
    /** Project DB URL written to `sys_project.database_url`. */
    projectDatabaseUrl: string;
    /** Project DB driver name (e.g. `sqlite`, `turso`). */
    projectDatabaseDriver: string;
}

/**
 * Insert the local org + project rows if they don't yet exist. Safe to call
 * on every boot — uses `find` with an exact-id filter for the existence
 * check.
 */
export async function ensureLocalIdentity(opts: LocalIdentityOptions): Promise<void> {
    const {
        objectql,
        orgId = LOCAL_ORG_ID,
        projectId = LOCAL_PROJECT_ID,
        orgName = 'Local',
        projectDatabaseUrl,
        projectDatabaseDriver,
    } = opts;

    if (!objectql) return;
    const now = new Date().toISOString();

    // ── Organization ─────────────────────────────────────────────────────
    let existingOrg = await safeFind(objectql, 'sys_organization', orgId);
    if (!existingOrg?.length) {
        await safeInsert(objectql, 'sys_organization', {
            id: orgId,
            name: orgName,
            slug: orgId,
            created_at: now,
            updated_at: now,
        });
    }

    // ── Project ──────────────────────────────────────────────────────────
    let existingProject = await safeFind(objectql, 'sys_project', projectId);
    if (!existingProject?.length) {
        await safeInsert(objectql, 'sys_project', {
            id: projectId,
            organization_id: orgId,
            display_name: orgName,
            is_default: true,
            is_system: false,
            plan: 'free',
            status: 'active',
            created_by: 'system',
            database_url: projectDatabaseUrl,
            database_driver: projectDatabaseDriver,
            created_at: now,
            updated_at: now,
        });
    }
}

async function safeFind(objectql: any, name: string, id: string): Promise<any[] | null> {
    try {
        const result = await objectql.find(name, { filters: [['id', '=', id]], top: 1 });
        // Some ObjectQL implementations wrap results in `{ value }`.
        const rows = (result && (result as any).value) ?? result;
        return Array.isArray(rows) ? rows : [];
    } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn(`[ensureLocalIdentity] find ${name} failed:`, err?.message ?? err);
        return null;
    }
}

async function safeInsert(objectql: any, name: string, doc: Record<string, unknown>): Promise<void> {
    try {
        await objectql.insert(name, doc);
    } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn(`[ensureLocalIdentity] insert ${name} failed:`, err?.message ?? err);
    }
}
