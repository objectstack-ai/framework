// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { AppSidebar } from '../components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { PluginHost } from '../plugins';
import { usePackages } from '../hooks/usePackages';

function ObjectViewComponent() {
  const { name } = Route.useParams();
  const { packages, selectedPackage } = usePackages();

  return (
    <>
      <AppSidebar
        packages={packages}
        selectedPackage={selectedPackage}
      />
      <main className="flex min-w-0 flex-1 flex-col h-svh overflow-hidden bg-background">
        <SiteHeader
          selectedObject={name}
          selectedView="object"
          packageLabel={selectedPackage?.manifest?.name || selectedPackage?.manifest?.id}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <PluginHost
            metadataType="object"
            metadataName={name}
            packageId={selectedPackage?.manifest?.id}
          />
        </div>
      </main>
    </>
  );
}

export const Route = createFileRoute('/$package/objects/$name')({
  component: ObjectViewComponent,
});
