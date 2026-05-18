// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectStack ObjectOS — Host Configuration (runtime node)
 *
 * Booted by `objectstack dev` / `objectstack serve` (see `package.json`).
 *
 * ObjectOS is a **stateless multi-tenant runtime**. The host kernel here is
 * a routing shell: every incoming request is resolved by hostname to a
 * project, the project's compiled artifact is fetched (either from a
 * control plane over HTTP or from a local file), and a per-project
 * ObjectKernel is built on demand and cached.
 *
 * ## Boot modes
 *
 * Default (no env): connects to a locally-running `apps/cloud` on
 * `http://localhost:4000`. Spin both up side-by-side for the natural
 * dev loop (`apps/cloud` for control plane + Studio, `apps/objectos`
 * for the actual runtime that serves project data).
 *
 * Override via env:
 *   - `OS_CLOUD_URL=https://cloud.objectstack.ai` — point at the
 *     hosted ObjectStack Cloud (or any other control plane).
 *   - `OS_CLOUD_URL=file` — file-backed single-project mode. Reads one
 *     compiled artifact from `dist/objectstack.json` (or
 *     `OS_ARTIFACT_PATH`) and serves it on every hostname. Use this
 *     for smoke tests / one-shot demos where bringing up a separate
 *     control plane is overkill.
 *
 * No `@objectstack/service-cloud` dependency — `apps/objectos` only
 * needs the runtime + the artifact loader, both of which live in
 * `@objectstack/runtime`.
 */

import { createObjectOSStack } from '@objectstack/runtime';

const cloudUrl = process.env.OS_CLOUD_URL?.trim() || 'http://localhost:4000';

const config = await createObjectOSStack({
    controlPlaneUrl: cloudUrl,
    controlPlaneApiKey: process.env.OS_CLOUD_API_KEY,
    fileConfig: cloudUrl === 'file'
        ? {
            artifactPath: process.env.OS_ARTIFACT_PATH,
            projectId: process.env.OS_PROJECT_ID,
        }
        : undefined,
});

export default config;
