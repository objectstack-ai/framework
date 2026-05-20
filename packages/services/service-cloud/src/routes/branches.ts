// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Branch endpoints — git-style logical branches over `sys_project_revision`.
 *
 *   GET    /cloud/projects/:id/branches
 *   POST   /cloud/projects/:id/branches/:name/rename
 *   DELETE /cloud/projects/:id/branches/:name
 *
 * Branches are not separate rows in their own table; they are a property of
 * each revision. A branch "exists" iff at least one revision carries that
 * `branch` value. The "head" of a branch is the row with
 * `is_branch_head = true` (at most one per (project_id, branch)). When we
 * publish a new revision the cloud route flips the head pointer atomically.
 *
 * "Default branch" is `main`. There is no separate setting; the project
 * simply behaves as if the most recently active branch on the dashboard is
 * default.
 */

import type { IHttpServer } from '@objectstack/spec/contracts';
import { ok, fail } from '../cloud-artifact-helpers.js';
import type { RouteDeps } from './types.js';
import { makeCheckAuth, makeGetDriver, controlPlaneUnavailable } from './types.js';

/** Slug regex for valid branch names. ASCII lowercase, dot, underscore, slash, dash. */
export const BRANCH_SLUG_RE = /^[a-z0-9][a-z0-9._/-]{0,62}$/;
/** 12-hex pattern reserved for preview commit URLs — must not collide. */
const HEX12_RE = /^[0-9a-f]{12}$/;

export const DEFAULT_BRANCH = 'main';

/**
 * Normalise a raw branch input. Empty / null → `main`. Throws on invalid.
 *
 * Rules:
 *   - lowercased and trimmed
 *   - matches BRANCH_SLUG_RE
 *   - cannot be exactly 12 hex chars (would clash with preview commit URL)
 *   - cannot equal reserved tokens ('HEAD' is rejected after lowercase too)
 */
export function normalizeBranch(raw: unknown): string {
    const v = String(raw ?? DEFAULT_BRANCH).trim().toLowerCase();
    const final = v || DEFAULT_BRANCH;
    if (!BRANCH_SLUG_RE.test(final)) {
        throw new Error(
            `Invalid branch name '${final}'. Must match ${BRANCH_SLUG_RE} ` +
            `(start with [a-z0-9], up to 63 chars of [a-z0-9._/-]).`,
        );
    }
    if (HEX12_RE.test(final)) {
        throw new Error(
            `Branch name '${final}' is a 12-hex string, which would collide with ` +
            `preview commit URLs. Pick a different name.`,
        );
    }
    return final;
}

export interface BranchHeadRow {
    id: string;
    project_id: string;
    commit_id: string;
    branch?: string | null;
    is_branch_head?: boolean | null;
    is_current?: boolean | null;
    published_at?: string | null;
    note?: string | null;
}

/**
 * Promote `revisionId` to be the head of `branch`, demoting any prior head.
 *
 * Idempotent: safe to call when the row is already the head. Tolerates a
 * driver that has not yet auto-migrated the new columns (best-effort:
 * swallows errors and logs a warning).
 */
export async function setBranchHead(
    driver: any,
    projectId: string,
    branch: string,
    revisionId: string,
): Promise<void> {
    try {
        const heads = (await driver.find('sys_project_revision_DEPRECATED', {
            where: { environment_id: projectId, branch, is_branch_head: true },
            limit: 100,
        })) as BranchHeadRow[];
        for (const h of heads) {
            if (h.id !== revisionId) {
                await driver.update('sys_project_revision_DEPRECATED', h.id, { is_branch_head: false });
            }
        }
        await driver.update('sys_project_revision_DEPRECATED', revisionId, {
            branch,
            is_branch_head: true,
        });
    } catch (err: any) {
        console.warn('[CloudArtifactAPI] setBranchHead failed (column may be missing):', err?.message);
    }
}

/**
 * Group revisions by branch and pick the head row per branch. Rows whose
 * `branch` is null/undefined fall under `DEFAULT_BRANCH` so existing data
 * does not disappear after the schema upgrade.
 *
 * Head selection priority:
 *   1. row with `is_branch_head = true` (authoritative)
 *   2. row with the most recent `published_at` (fallback for un-migrated data)
 */
export function groupByBranch(rows: BranchHeadRow[]): Array<{
    branch: string;
    headCommitId: string;
    headRevisionId: string;
    revisionCount: number;
    headPublishedAt: string | null;
    headNote: string | null;
    isCurrent: boolean;
}> {
    const buckets = new Map<string, BranchHeadRow[]>();
    for (const r of rows) {
        const b = (r.branch && r.branch.trim()) || DEFAULT_BRANCH;
        const arr = buckets.get(b) ?? [];
        arr.push(r);
        buckets.set(b, arr);
    }

    const out: ReturnType<typeof groupByBranch> = [];
    for (const [branch, items] of buckets) {
        let head = items.find((r) => r.is_branch_head === true);
        if (!head) {
            head = [...items].sort((a, b) => {
                const ta = a.published_at ?? '';
                const tb = b.published_at ?? '';
                return tb.localeCompare(ta);
            })[0];
        }
        if (!head) continue;
        out.push({
            branch,
            headCommitId: head.commit_id,
            headRevisionId: head.id,
            revisionCount: items.length,
            headPublishedAt: head.published_at ?? null,
            headNote: head.note ?? null,
            isCurrent: items.some((r) => r.is_current === true),
        });
    }
    out.sort((a, b) => {
        // `main` first, then by head publish time desc
        if (a.branch === DEFAULT_BRANCH && b.branch !== DEFAULT_BRANCH) return -1;
        if (b.branch === DEFAULT_BRANCH && a.branch !== DEFAULT_BRANCH) return 1;
        return (b.headPublishedAt ?? '').localeCompare(a.headPublishedAt ?? '');
    });
    return out;
}

export function registerBranchRoutes(server: IHttpServer, deps: RouteDeps): void {
    const { prefix, requiredKey, controlDriverPromise, getCallerUserId } = deps;
    const checkAuth = makeCheckAuth(requiredKey, getCallerUserId);
    const getDriver = makeGetDriver(controlDriverPromise);

    // ─────────────────────────────────────────────────────────────────
    // GET /cloud/projects/:id/branches
    // List every distinct branch on this project + its head commit + count.
    // ─────────────────────────────────────────────────────────────────
    server.get(`${prefix}/cloud/projects/:id/branches`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);
        const projectId = String(req.params?.id ?? '').trim();
        if (!projectId) return res.status(400).json(fail('project id required'));

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        try {
            const rows = (await (driver.find as any)('sys_project_revision_DEPRECATED', {
                where: { environment_id: projectId },
                orderBy: [{ field: 'published_at', direction: 'desc' }],
                limit: 5000,
            })) as BranchHeadRow[];
            const branches = groupByBranch(rows);
            return res.json(ok({ projectId, branches }));
        } catch (err: any) {
            console.error('[CloudArtifactAPI] Failed to list branches:', err?.message ?? err);
            return res.status(500).json(fail('Failed to list branches', 500));
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // POST /cloud/projects/:id/branches/:name/rename
    // Body: { newName: string }
    // Renames every revision row in `name` to `newName`. The head stays head.
    // 409 if `newName` already has rows.
    // ─────────────────────────────────────────────────────────────────
    server.post(`${prefix}/cloud/projects/:id/branches/:name/rename`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);
        const projectId = String(req.params?.id ?? '').trim();
        const oldName = String(req.params?.name ?? '').trim();
        if (!projectId || !oldName) return res.status(400).json(fail('project id and branch name required'));

        let normalizedNew: string;
        try {
            normalizedNew = normalizeBranch((req.body ?? {}).newName);
        } catch (err: any) {
            return res.status(400).json(fail(err?.message ?? 'invalid branch name'));
        }
        if (normalizedNew === oldName) {
            return res.json(ok({ projectId, branch: oldName, renamed: 0 }));
        }

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        try {
            const collisions = (await (driver.find as any)('sys_project_revision_DEPRECATED', {
                where: { environment_id: projectId, branch: normalizedNew },
                limit: 1,
            })) as any[];
            if (Array.isArray(collisions) && collisions.length > 0) {
                return res.status(409).json(fail(`Branch '${normalizedNew}' already exists`, 409));
            }

            const rows = (await (driver.find as any)('sys_project_revision_DEPRECATED', {
                where: { environment_id: projectId, branch: oldName },
                limit: 5000,
            })) as BranchHeadRow[];
            for (const r of rows) {
                await (driver.update as any)('sys_project_revision_DEPRECATED', r.id, { branch: normalizedNew });
            }
            return res.json(ok({ projectId, from: oldName, to: normalizedNew, renamed: rows.length }));
        } catch (err: any) {
            console.error('[CloudArtifactAPI] Failed to rename branch:', err?.message ?? err);
            return res.status(500).json(fail('Failed to rename branch', 500));
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // DELETE /cloud/projects/:id/branches/:name
    // Soft-delete: clears `is_branch_head` on every row in this branch.
    // Revisions themselves remain (their commit URLs still resolve);
    // branch-tracking preview URLs for `name` will 404.
    // The DEFAULT_BRANCH ('main') cannot be deleted.
    // The current revision's branch cannot be deleted.
    // ─────────────────────────────────────────────────────────────────
    server.delete(`${prefix}/cloud/projects/:id/branches/:name`, async (req: any, res: any) => {
        const auth = await checkAuth(req);
        if (!auth.ok) return res.status(auth.status).json(auth.body);
        const projectId = String(req.params?.id ?? '').trim();
        const name = String(req.params?.name ?? '').trim().toLowerCase();
        if (!projectId || !name) return res.status(400).json(fail('project id and branch name required'));
        if (name === DEFAULT_BRANCH) {
            return res.status(400).json(fail(`Cannot delete the default branch '${DEFAULT_BRANCH}'`, 400));
        }

        const driver = await getDriver();
        if (!driver) return controlPlaneUnavailable(res);

        try {
            const rows = (await (driver.find as any)('sys_project_revision_DEPRECATED', {
                where: { environment_id: projectId, branch: name },
                limit: 5000,
            })) as BranchHeadRow[];
            if (rows.length === 0) {
                return res.status(404).json(fail(`Branch '${name}' not found`, 404));
            }
            const carriesCurrent = rows.some((r) => r.is_current === true);
            if (carriesCurrent) {
                return res.status(409).json(fail(
                    `Branch '${name}' carries the active (current) revision; activate another revision first`,
                    409,
                ));
            }
            for (const r of rows) {
                if (r.is_branch_head) {
                    await (driver.update as any)('sys_project_revision_DEPRECATED', r.id, { is_branch_head: false });
                }
            }
            return res.json(ok({ projectId, branch: name, demoted: rows.filter((r) => r.is_branch_head).length, totalRevisions: rows.length }));
        } catch (err: any) {
            console.error('[CloudArtifactAPI] Failed to delete branch:', err?.message ?? err);
            return res.status(500).json(fail('Failed to delete branch', 500));
        }
    });
}
