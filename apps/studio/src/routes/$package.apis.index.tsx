// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function ApisListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="APIs"
      subtitle="REST endpoints, GraphQL contracts, and external connectors."
      types={['api', 'connector']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/apis/')({
  component: ApisListComponent,
});
