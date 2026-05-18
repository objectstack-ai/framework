// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Cloud — Host Configuration
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`)
 * and by the Vercel / Cloudflare serverless entrypoints.
 *
 * This config is **cloud-only** — multi-project control plane with the
 * Studio template registry and filesystem-backed app bundle resolver
 * wired in. `apps/objectos` is the runtime that talks to this control
 * plane; their boot configs are now fully independent (no shared
 * `createBootStack` dispatcher).
 */

import { createCloudStack } from '@objectstack/service-cloud';
import { createFsAppBundleResolver } from './server/fs-app-bundle-resolver.js';
import { templateRegistry } from './server/templates/registry.js';

const authSecret = process.env.AUTH_SECRET
    ?? process.env.BETTER_AUTH_SECRET
    ?? process.env.OS_AUTH_SECRET
    ?? '';
if (!authSecret) {
    throw new Error('apps/cloud: AUTH_SECRET (or BETTER_AUTH_SECRET / OS_AUTH_SECRET) is required.');
}

const baseUrl = process.env.OS_BASE_URL
    ?? process.env.BETTER_AUTH_URL
    ?? `http://localhost:${process.env.PORT ?? '4000'}`;

const config = await createCloudStack({
    authSecret,
    baseUrl,
    templates: templateRegistry,
    appBundles: createFsAppBundleResolver(),
});

export default config;
