// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function AutomationsListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="Automations"
      subtitle="Flows, workflows, approvals, webhooks, and lifecycle hooks."
      types={['flow', 'workflow', 'approval', 'webhook', 'hook']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/automations/')({
  component: AutomationsListComponent,
});
