// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `/organizations/:orgId` redirect — defaults to the General settings page.
 */

import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/organizations/$orgId/')({
  component: () => {
    const { orgId } = Route.useParams();
    return <Navigate to="/organizations/$orgId/general" params={{ orgId }} replace />;
  },
});
