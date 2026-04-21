// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useEnvironments } from '@/hooks/useEnvironments';

function IndexRedirect() {
  const navigate = useNavigate();
  const { user, session, loading: sessionLoading } = useSession();
  const { environments, loading: envsLoading } = useEnvironments();

  useEffect(() => {
    if (sessionLoading || !user) return; // RequireAuth sends to /login

    if (!session?.activeOrganizationId) {
      navigate({ to: '/orgs' });
      return;
    }
    if (envsLoading) return;

    const lastEnvId = localStorage.getItem('objectstack.lastEnvId');
    const targetEnv =
      (lastEnvId && environments.find((e) => e.id === lastEnvId)) ||
      environments.find((e) => e.isDefault) ||
      environments[0];

    if (targetEnv) {
      navigate({
        to: '/environments/$environmentId',
        params: { environmentId: targetEnv.id },
      });
    } else {
      navigate({ to: '/environments' });
    }
  }, [user, session, sessionLoading, environments, envsLoading, navigate]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: IndexRedirect,
});
