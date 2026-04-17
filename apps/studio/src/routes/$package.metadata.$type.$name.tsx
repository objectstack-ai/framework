// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { SiteHeader } from '@/components/site-header';
import { PluginHost } from '../plugins';
import { usePackages } from '../hooks/usePackages';

function MetadataViewComponent() {
  const { type, name } = Route.useParams();
  const { selectedPackage } = usePackages();

  return (
    <>
      <SiteHeader
        selectedMeta={{ type, name }}
        selectedView="metadata"
        packageLabel={selectedPackage?.manifest?.name || selectedPackage?.manifest?.id}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PluginHost
          metadataType={type}
          metadataName={name}
          packageId={selectedPackage?.manifest?.id}
        />
      </div>
    </>
  );
}

export const Route = createFileRoute('/$package/metadata/$type/$name')({
  component: MetadataViewComponent,
});
