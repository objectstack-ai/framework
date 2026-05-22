// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function SecurityListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="Security"
      subtitle="Roles, profiles, permission sets, sharing rules, and policies."
      types={['role', 'profile', 'permission', 'sharingRule', 'policy']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/security/')({
  component: SecurityListComponent,
});
