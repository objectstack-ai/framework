// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Legacy /packages route — redirects to the env-scoped packages page.
 * Package management is now per-environment: /environments/:envId/packages.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/packages')({
  beforeLoad: () => {
    // Redirect to environments list so user selects an env first.
    throw redirect({ to: '/environments' });
  },
  component: () => null,
});
