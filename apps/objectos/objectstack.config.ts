// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration (runtime node)
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * ## Boot modes
 *
 * Default: single-project **local** mode. `pnpm dev` runs a self-contained
 * server with one control DB on disk and Studio UI in single-project mode
 * (no org/project picker — platform metadata only).
 *
 * Override via env:
 *   - `OBJECTSTACK_CLOUD_URL=http://localhost:4000`         — connect to a
 *     locally-running `apps/cloud` (multi-project control plane).
 *   - `OBJECTSTACK_CLOUD_URL=https://cloud.objectstack.ai`  — hosted
 *     control plane.
 *   - `OBJECTSTACK_MODE=cloud`                              — boot the
 *     multi-project control plane in this very process (lives in
 *     `apps/cloud`).
 *
 * All boot orchestration lives in `@objectstack/service-cloud`. This file
 * only supplies the apps/server-specific knobs (filesystem app bundle
 * resolution).
 */

import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBootStack } from '@objectstack/service-cloud';
import { createFsAppBundleResolver } from './server/fs-app-bundle-resolver.js';

const serverDir = dirname(fileURLToPath(import.meta.url));
const dataDir = resolvePath(serverDir, '.objectstack/data');
const localArtifactPath = process.env.OBJECTSTACK_ARTIFACT_PATH
    ?? resolvePath(serverDir, 'dist/objectstack.json');

const config = await createBootStack({
    runtime: {
        dataDir,
        artifactPath: localArtifactPath,
        appBundles: createFsAppBundleResolver(),
        // Default to single-project local mode (`cloudUrl: 'local'`) so
        // `pnpm dev` boots a self-contained server: one project, one
        // control DB on disk, Studio UI in single-project mode (no
        // org/project picker — platform metadata only).
        //
        // Override with:
        //   - `OBJECTSTACK_CLOUD_URL=http://localhost:4000` to connect to
        //     a locally-running `apps/cloud` (multi-project control plane)
        //   - `OBJECTSTACK_CLOUD_URL=https://cloud.objectstack.ai` for the
        //     hosted control plane
        cloudUrl: process.env.OBJECTSTACK_CLOUD_URL ?? 'local',
        cloudApiKey: process.env.OBJECTSTACK_CLOUD_API_KEY,
    },
});

export default config;
