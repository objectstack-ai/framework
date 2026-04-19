// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/orgs/')({
  component: OrgsLayout,
});

function OrgsLayout() {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <Outlet />
    </div>
  );
}
