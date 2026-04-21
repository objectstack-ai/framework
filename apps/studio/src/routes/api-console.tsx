// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute } from '@tanstack/react-router';
import { ApiConsolePage } from '../components/ApiConsolePage';

function ApiConsoleComponent() {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-hidden">
        <ApiConsolePage />
      </div>
    </main>
  );
}

export const Route = createFileRoute('/api-console')({
  component: ApiConsoleComponent,
});
