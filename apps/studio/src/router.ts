// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Route Tree Configuration
 *
 * TanStack Router auto-generates this file from routes/ directory.
 * This import is required for the router to work.
 */

import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({ routeTree });

// Register things for type-safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
