// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { AppSidebar } from '../components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { DeveloperOverview } from '../components/DeveloperOverview';
import { usePackages } from '../hooks/usePackages';

function IndexComponent() {
  const { packages, selectedPackage } = usePackages();

  return (
    <>
      <AppSidebar
        packages={packages}
        selectedPackage={selectedPackage}
      />
      <main className="flex min-w-0 flex-1 flex-col h-svh overflow-hidden bg-background">
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
      </main>
    </>
  );
}

export const Route = createFileRoute('/')({
  component: IndexComponent,
});
