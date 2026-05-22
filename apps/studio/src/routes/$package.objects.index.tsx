// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function ObjectsListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="Objects"
      subtitle="Data model — every object you can query, edit, and bind UI to."
      types={['object']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/objects/')({
  component: ObjectsListComponent,
});
