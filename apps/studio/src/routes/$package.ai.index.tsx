// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { MetadataListPage } from '@/components/MetadataListPage';

function AiListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <MetadataListPage
      title="AI"
      subtitle="Agents, tools, and RAG pipelines. Use Playground → Agent to test live."
      types={['agent', 'tool', 'ragPipeline']}
      packageId={packageId}
    />
  );
}

export const Route = createFileRoute('/$package/ai/')({
  component: AiListComponent,
});
