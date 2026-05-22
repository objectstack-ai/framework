// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function AiListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="AI"
      subtitle="Agents, tools, and skills. Pick an agent and chat with it from the right-hand assistant panel, or invoke a tool from Playground → Tool."
      types={['agent', 'tool', 'skill']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/ai/')({
  component: AiListComponent,
});
