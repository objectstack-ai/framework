// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack Server — Host Configuration (local)
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * ## Boot modes
 *
 * Selected via the `OBJECTSTACK_MODE` environment variable:
 *
 *   - `project`   (default) — local single-project deployment. Reuses the
 *                            cloud (multi-project) plugin stack but backs
 *                            it with two SQLite files (`control.db` for
 *                            the control plane, `proj_local.db` for the
 *                            single project's business data).
 *                            Aliases: `local`, `single-project`.
 *   - `standalone`         — runtime-only (ObjectQL + REST + Driver).
 *
 * The `cloud` (multi-project, hosted) mode lives in `apps/cloud`.
 *
 * All boot orchestration now lives in @objectstack/service-cloud.
 * This file only supplies the apps/server-specific knobs (filesystem
 * app bundle resolution).
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
    project: {
        dataDir,
        artifactPath: localArtifactPath,
        appBundles: createFsAppBundleResolver(),
        // ObjectStack Cloud runtime is the default; set
        // `OBJECTSTACK_CLOUD_URL=local` to fall back to a local control
        // DB for offline / single-machine development.
        cloudUrl: process.env.OBJECTSTACK_CLOUD_URL,
        cloudApiKey: process.env.OBJECTSTACK_CLOUD_API_KEY,
    },
    standalone: {
        artifactPath: localArtifactPath,
        databaseUrl: process.env.OBJECTSTACK_DATABASE_URL
            ?? `file:${resolvePath(dataDir, 'standalone.db')}`,
    },
});

export default config;
