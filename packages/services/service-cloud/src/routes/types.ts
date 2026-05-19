// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared route-level types + tiny auth/driver helpers used by every
 * route module.
 */

import type { IDataDriver } from '@objectstack/spec/contracts';
import { fail } from '../cloud-artifact-helpers.js';
import type { StorageLike } from './storage.js';

/**
 * Bag of dependencies threaded through every route handler.
 * Centralising it here means each `register*Routes(...)` function takes
 * one argument and the assembly site stays compact.
 */
export interface RouteDeps {
    prefix: string;
    artifactRoot: string;
    keyPrefix: string;
    storage: StorageLike;
    storageAdapterName: string;
    requiredKey: string | undefined;
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>;
    /**
     * Resolve the caller's user id from the request headers using better-auth's
     * `getSession`. When the auth service is unavailable this resolves to
     * `undefined`. Optional so unit tests / legacy callers can omit it.
     */
    getCallerUserId?: (req: any) => Promise<string | undefined>;
    /** Resolve the caller's active organization id via better-auth. */
    getCallerActiveOrgId?: (req: any) => Promise<string | undefined>;
}

export type AuthResult = { ok: true } | { ok: false; status: number; body: any };

/** Bearer-token gate. When no key is configured, all requests pass. */
export function makeCheckAuth(requiredKey: string | undefined) {
    return (req: any): AuthResult => {
        if (!requiredKey) return { ok: true };
        const header = (req.headers?.authorization ?? req.headers?.Authorization ?? '') as string;
        const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
        if (token === requiredKey) return { ok: true };
        return { ok: false, status: 401, body: { success: false, error: 'Unauthorized' } };
    };
}

/** Lazy driver accessor — returns null and logs when control plane is unavailable. */
export function makeGetDriver(
    controlDriverPromise: Promise<{ driver: IDataDriver; driverName: string; databaseUrl: string }>,
) {
    return async (): Promise<IDataDriver | null> => {
        try {
            const { driver } = await controlDriverPromise;
            return driver ?? null;
        } catch (err: any) {
            console.error('[CloudArtifactAPI] control driver unavailable:', err?.message ?? err);
            return null;
        }
    };
}

/** Helper to ship a "control plane unavailable" 503 envelope. */
export function controlPlaneUnavailable(res: any) {
    return res.status(503).json(fail('control plane unavailable', 503));
}
