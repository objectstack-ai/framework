// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { DeveloperOverview } from '../components/DeveloperOverview';
import { useEnvAwarePackages } from '../hooks/useEnvAwarePackages';

function EnvPackageIndexComponent() {
  const { environmentId } = Route.useParams();
  const { packages, selectedPackage } = useEnvAwarePackages(environmentId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DeveloperOverview packages={packages} selectedPackage={selectedPackage} />
    </div>
  );
}

export const Route = createFileRoute('/environments/$environmentId/$package/')({
  component: EnvPackageIndexComponent,
});
