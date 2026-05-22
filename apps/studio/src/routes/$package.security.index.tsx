// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function SecurityListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="Security"
      subtitle="Roles, profiles, and permission definitions for this package."
      types={['role', 'profile', 'permission']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/security/')({
  component: SecurityListComponent,
});
