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
    const inner = await getApp();
    return inner.fetch(c.req.raw);
});

export default handle(app);
