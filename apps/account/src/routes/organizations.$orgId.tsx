// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Organization layout — header + nested Outlet (General / Members).
 *
 * The actual section navigation lives in the global Account sidebar, which
 * detects `/organizations/:orgId/*` paths and renders an "Organization" group.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useOrganizations } from '@/hooks/useSession';

export const Route = createFileRoute('/organizations/$orgId')({
  component: OrgLayout,
});

function OrgLayout() {
  const { orgId } = Route.useParams();
  const { organizations } = useOrganizations();
  const org = organizations.find((o) => o.id === orgId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header>
            <h1 className="text-2xl font-semibold">{org?.name ?? 'Organization'}</h1>
            {org?.slug && (
              <p className="text-sm text-muted-foreground font-mono">{org.slug}</p>
            )}
          </header>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
