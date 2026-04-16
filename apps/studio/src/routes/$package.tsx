// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AppSidebar } from '../components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { usePackages } from '../hooks/usePackages';
import { useEffect } from 'react';

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
        <SiteHeader
          selectedView="overview"
          packageLabel={selectedPackage?.manifest?.name || selectedPackage?.manifest?.id}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </main>
    </>
  );
}

export const Route = createFileRoute('/$package')({
  component: PackageLayoutComponent,
});
