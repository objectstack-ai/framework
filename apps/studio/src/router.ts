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
 * Studio is always mounted under `/_studio/` — the Vite build sets
 * `base: '/_studio/'` by default (see `vite.config.ts`), which makes
 * `import.meta.env.BASE_URL === '/_studio/'` for every production bundle
 * and `/_studio/` for the CLI dev server (which also sets `VITE_BASE`).
 *
 * TanStack Router expects the basepath WITHOUT a trailing slash (except
 * for the root `'/'`), so we normalise accordingly.
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
