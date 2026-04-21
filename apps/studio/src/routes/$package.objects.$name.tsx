// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/$package/objects/$name')({
  beforeLoad: ({ params }) => {
    const lastProjectId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('objectstack.lastProjectId')
        : null;

    if (lastProjectId) {
      throw redirect({
        to: '/projects/$projectId/$package/objects/$name',
        params: { projectId: lastProjectId, package: params.package, name: params.name },
        replace: true,
      });
    }
    throw redirect({ to: '/projects', replace: true });
  },
  component: () => null,
});
