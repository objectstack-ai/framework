// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppSidebar } from '../components/app-sidebar';
import { usePackages } from '../hooks/usePackages';
import { useEffect } from 'react';

/**
 * Layout for every `/$package/*` route.
 *
 * Renders the persistent left `AppSidebar` and the main content frame, and
 * delegates the `SiteHeader` + body rendering to the child leaf routes via
 * `<Outlet />`. Keeping the header in the children lets each leaf (index,
 * object view, metadata view) provide accurate breadcrumbs without prop-
 * drilling. It also prevents the duplicated-shell bug that occurred when
 * both this layout and its children each rendered their own `AppSidebar`.
 */
function PackageLayoutComponent() {
  const { package: packageId } = Route.useParams();
  const { packages, selectedPackage, setSelectedPackage } = usePackages();

  // Update selected package when route param changes
  useEffect(() => {
    const pkg = packages.find(p => p.manifest?.id === packageId);
    if (pkg && pkg !== selectedPackage) {
      setSelectedPackage(pkg);
    }
  }, [packageId, packages, selectedPackage, setSelectedPackage]);

  return (
    <>
      <AppSidebar
        packages={packages}
        selectedPackage={selectedPackage}
        onSelectPackage={setSelectedPackage}
      />
      <main className="flex min-w-0 flex-1 flex-col h-svh overflow-hidden bg-background">
        <Outlet />
      </main>
    </>
  );
}

export const Route = createFileRoute('/$package')({
  component: PackageLayoutComponent,
});
