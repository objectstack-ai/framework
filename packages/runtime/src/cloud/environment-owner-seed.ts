/**
 * Pre-seed the project owner into a freshly-provisioned project DB.
 *
 * Why this exists
 * ---------------
 * When a user creates a project on the cloud control plane, the project
 * gets a brand-new isolated database. On first access, the SSO callback
 * would otherwise treat the project owner as just another anonymous JIT
 * user — no admin role, no membership, no recognition that *this is the
 * person who owns this project*. The owner then has to manually promote
 * themselves via the org membership UI, which is friction the user does
 * not deserve to pay.
 *
 * Worse: better-auth's `accountLinking` safety check rejects implicit
 * link of an unverified local row with an unverified OAuth identity
 * (`error=account_not_linked`). Pre-seeding with `emailVerified: true`
 * (cloud already verified them upstream) makes the link clean.
 *
 * Idempotency
 * -----------
 * The seed is keyed by the cloud `userId`. If a `sys_user` row with that
 * id already exists in the project DB, this is a no-op — safe to call
 * on every cold-boot. SecurityPlugin's `sys_user` insert middleware
 * (mounted by ArtifactKernelFactory) auto-creates the personal
 * organization + `sys_member(owner)` binding as a side effect of the
 * insert, so callers do not need to wire membership themselves.
 */

import type { ObjectKernel } from '@objectstack/core';

export interface ProjectOwnerSeed {
    /** Cloud `sys_user.id` of the project creator. Used as the project-side `sys_user.id` so SSO callbacks link by id, not by email-match. */
    userId: string;
    /** Verified email at cloud — copied here so the link check passes without a project-side verification flow. */
    email: string;
    /** Display name; nullable to tolerate users who never set one. */
    name?: string | null;
    /** Avatar URL; nullable. */
    image?: string | null;
}

const SYS_USER = 'sys_user';

/**
 * Insert the project owner into the project's `sys_user` table.
 *
 * Returns:
 *   - `'inserted'` — the row was newly seeded
 *   - `'exists'`   — a row with this id already existed (no-op)
 *   - `'skipped'`  — payload missing required fields (no-op)
 *   - `'error'`    — an unexpected failure; details logged via `logger.warn`
 *                     (we never throw — owner seed is best-effort)
 */
export async function seedProjectOwner(
    kernel: ObjectKernel,
    seed: ProjectOwnerSeed,
    logger?: { info?: (msg: string, ctx?: any) => void; warn?: (msg: string, ctx?: any) => void },
): Promise<'inserted' | 'exists' | 'skipped' | 'error'> {
    if (!seed?.userId || !seed?.email) return 'skipped';

    try {
        const ql: any = kernel.getService('objectql');
        if (!ql?.insert || !ql?.find) {
            logger?.warn?.('[seedProjectOwner] objectql service unavailable', { userId: seed.userId });
            return 'skipped';
        }

        // Idempotency check: bail if the owner is already present. We key
        // off `id` (not email) so re-runs are safe even if the user later
        // changes their cloud email.
        try {
            const existing = await ql.find(SYS_USER, { where: { id: seed.userId } } as any);
            const rows = Array.isArray(existing) ? existing : (existing?.value ?? []);
            if (Array.isArray(rows) && rows.length > 0) return 'exists';
        } catch {
            // `find` may legitimately fail on cold-start before the schema
            // is fully synced. Fall through to the insert — uniqueness will
            // also be enforced at the DB layer.
        }

        const nowIso = new Date().toISOString();
        await ql.insert(SYS_USER, {
            id: seed.userId,
            email: seed.email,
            name: seed.name ?? seed.email.split('@')[0] ?? 'Owner',
            image: seed.image ?? null,
            // Cloud already verified the upstream email. Marking it verified
            // here is what unblocks better-auth's accountLinking check on
            // the first SSO callback (alongside the trustedProviders config
            // in plugin-auth/auth-manager.ts).
            email_verified: true,
            created_at: nowIso,
            updated_at: nowIso,
        });

        logger?.info?.('[seedProjectOwner] owner seeded', {
            userId: seed.userId,
            email: seed.email,
        });
        return 'inserted';
    } catch (err: any) {
        // Common benign cases: race with another cold-boot, or unique
        // constraint violation if two requests interleave. Log + swallow.
        logger?.warn?.('[seedProjectOwner] failed (non-fatal)', {
            userId: seed.userId,
            error: err?.message,
        });
        return 'error';
    }
}
