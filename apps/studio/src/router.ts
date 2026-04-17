// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Route Tree Configuration
 *
 * TanStack Router auto-generates this file from routes/ directory.
 * This import is required for the router to work.
 */

import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

/**
 * Compute the router basepath from Vite's `BASE_URL`.
 *
 * When Studio is mounted under a sub-path (e.g. `/_studio/` via the CLI `--ui`
 * flag, which sets `VITE_BASE=/_studio/`), TanStack Router must strip that
 * prefix before matching route patterns. Otherwise URLs such as
 * `/_studio/packages` are mis-interpreted as `/$package="_studio"/packages`.
 *
 * Vite exposes the configured base as `import.meta.env.BASE_URL`:
 *   - Root deployment: `'/'` → basepath `'/'` (no-op)
 *   - Sub-path deployment: `'/_studio/'` → basepath `'/_studio'`
 *
 * TanStack Router expects the basepath WITHOUT a trailing slash (except for
 * the root `'/'`), so we normalise accordingly.
 */
function resolveBasepath(): string {
  const base = (import.meta.env.BASE_URL ?? '/').trim();
  if (!base || base === '/' || base === './') return '/';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export const router = createRouter({
  routeTree,
  basepath: resolveBasepath(),
});

// Register things for type-safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
