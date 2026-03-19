// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless Catch-All Route
 *
 * Handles all /api/* requests using the ObjectStack Hono application.
 * The Hono app provides discovery, data CRUD, metadata, auth, and more
 * endpoints under the /api/v1 prefix.
 *
 * File name convention: Vercel maps `[...path].ts` to a catch-all route
 * that matches /api and any sub-paths (/api/v1/data/task, etc.).
 */

import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { getApp } from './_kernel';

/**
 * Outer Hono app — synchronously created so it can be wrapped by handle().
 * Delegates all requests to the lazy-initialized inner app (which boots
 * the ObjectStack kernel on first invocation).
 */
const app = new Hono();

app.all('/*', async (c) => {
    try {
        const inner = await getApp();

        // Normalise the request URL so the inner Hono app always sees the
        // full /api/… prefix.  Vercel's Node.js runtime preserves it, but
        // some runtimes or proxies may strip the function directory prefix.
        const url = new URL(c.req.url);
        if (!url.pathname.startsWith('/api')) {
            url.pathname = '/api' + url.pathname;
            const request = new Request(url.toString(), c.req.raw);
            return await inner.fetch(request);
        }

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
