// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId/$package — env-scoped package workspace.
 *
 * The {@link AppSidebar} (metadata tree) is rendered by the parent
 * `/projects/$projectId` layout for ALL env-scoped routes, so this
 * layout only needs to provide the `<main>` content frame. The parent
 * layout watches `location.pathname` and keeps `selectedPackage` in sync
 * with the `$package` URL segment.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';

function EnvPackageLayoutComponent() {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <Outlet />
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/$package')({
  component: EnvPackageLayoutComponent,
});
