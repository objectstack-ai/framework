// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `/orgs/:orgId` redirect — defaults to the General settings page.
 */

import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/orgs/$orgId/')({
  component: () => {
    const { orgId } = Route.useParams();
    return <Navigate to="/orgs/$orgId/general" params={{ orgId }} replace />;
  },
});
