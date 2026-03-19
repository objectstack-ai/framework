// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint (Hono + Vercel Node Adapter)
 *
 * Top-level Hono app that delegates all /api/* requests to the
 * ObjectStack Hono application. The kernel boots lazily on the first
 * request and persists across warm invocations.
 *
 * Vercel's `vercel.json` rewrites route all `/api/*` traffic to this
 * single function — no catch-all `[...path].ts` is needed.
 *
 * @see https://hono.dev/docs/getting-started/vercel
 */

import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { ensureApp } from './_kernel';

const app = new Hono();

/**
 * Delegate every request to the lazily-initialized ObjectStack Hono app.
 * `ensureApp()` boots the kernel on the first invocation (cold start)
 * and returns the cached instance on subsequent warm invocations.
 */
app.all('*', async (c) => {
    try {
        const inner = await ensureApp();
        return await inner.fetch(c.req.raw);
    } catch (err: any) {
        console.error('[Vercel] Handler error:', err?.message || err);
        return c.json(
            { success: false, error: { message: err?.message || 'Internal Server Error', code: 500 } },
            500,
        );
    }
});

export default handle(app);
