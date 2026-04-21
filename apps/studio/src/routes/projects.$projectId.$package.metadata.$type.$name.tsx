// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { PluginHost } from '../plugins';
import { useEnvAwarePackages } from '../hooks/useProjectAwarePackages';

function EnvMetadataViewComponent() {
  const { projectId, package: packageId, type, name } = Route.useParams();
  const { selectedPackage } = useEnvAwarePackages(projectId);

  const resolvedPkgId = selectedPackage?.manifest?.id ?? packageId;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PluginHost
        metadataType={type}
        metadataName={name}
        packageId={resolvedPkgId}
      />
    </div>
  );
}

export const Route = createFileRoute(
  '/projects/$projectId/$package/metadata/$type/$name',
)({
  component: EnvMetadataViewComponent,
});
