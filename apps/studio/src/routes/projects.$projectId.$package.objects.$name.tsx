// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { PluginHost } from '../plugins';
import { useEnvAwarePackages } from '../hooks/useProjectAwarePackages';

function EnvObjectViewComponent() {
  const { projectId, package: packageId, name } = Route.useParams();
  const { selectedPackage } = useEnvAwarePackages(projectId);

  // Use selectedPackage?.manifest?.id (full ID) for PluginHost; fall back to URL param.
  const resolvedPkgId = selectedPackage?.manifest?.id ?? packageId;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PluginHost
        metadataType="object"
        metadataName={name}
        packageId={resolvedPkgId}
      />
    </div>
  );
}

export const Route = createFileRoute(
  '/projects/$projectId/$package/objects/$name',
)({
  component: EnvObjectViewComponent,
});
