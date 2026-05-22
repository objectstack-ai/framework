// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function ViewsListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="Views & Apps"
      subtitle="Grids, kanbans, dashboards, reports, pages, and app navigation. Form views have their own page under Forms."
      // Exclude form views — those have a dedicated /forms page.
      filterItem={(item, type) => {
        if (type !== 'view') return true;
        const vt = item?.spec?.viewType ?? item?.viewType;
        return vt !== 'form';
      }}
      types={['app', 'view', 'page', 'dashboard', 'report']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/views/')({
  component: ViewsListComponent,
});
