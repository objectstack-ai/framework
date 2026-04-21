// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Legacy `/$package` layout — redirects to the project-scoped equivalent.
 *
 * Package browsing is now per-project: `/projects/:projectId/:package/*`.
 * If the user's last-used project is known (localStorage), we redirect
 * directly there. Otherwise we send them to the project selection page.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$package')({
  beforeLoad: ({ params }) => {
    const lastProjectId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('objectstack.lastProjectId')
        : null;

    if (lastProjectId) {
      throw redirect({
        to: '/projects/$projectId/$package',
        params: { projectId: lastProjectId, package: params.package },
        replace: true,
      });
    }
    throw redirect({ to: '/projects', replace: true });
  },
  component: () => null,
});
