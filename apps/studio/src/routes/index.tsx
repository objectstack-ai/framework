// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { DeveloperOverview } from '../components/DeveloperOverview';
import { usePackages } from '../hooks/usePackages';

function IndexComponent() {
  const { packages, selectedPackage } = usePackages();

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <DeveloperOverview
          packages={packages}
          selectedPackage={selectedPackage}
        />
      </div>
    </main>
  );
}

export const Route = createFileRoute('/')({
  component: IndexComponent,
});
