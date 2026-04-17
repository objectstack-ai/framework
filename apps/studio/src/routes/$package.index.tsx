// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { SiteHeader } from '@/components/site-header';
import { DeveloperOverview } from '../components/DeveloperOverview';
import { usePackages } from '../hooks/usePackages';

/**
 * Leaf route for the exact `/$package` URL — the package overview page.
 *
 * Owns its own `SiteHeader`; the layout shell (sidebar + main wrapper) is
 * provided by the parent `$package.tsx` route.
 */
function PackageIndexComponent() {
  const { packages, selectedPackage } = usePackages();

  return (
    <>
      <SiteHeader
        selectedView="overview"
        packageLabel={selectedPackage?.manifest?.name || selectedPackage?.manifest?.id}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DeveloperOverview
          packages={packages}
          selectedPackage={selectedPackage}
        />
      </div>
    </>
  );
}

export const Route = createFileRoute('/$package/')({
  component: PackageIndexComponent,
});
