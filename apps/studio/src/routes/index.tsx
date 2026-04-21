// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useProjects } from '@/hooks/useProjects';

function IndexRedirect() {
  const navigate = useNavigate();
  const { user, session, loading: sessionLoading } = useSession();
  const { projects, loading: projectsLoading } = useProjects();

  useEffect(() => {
    if (sessionLoading || !user) return; // RequireAuth sends to /login

    if (!session?.activeOrganizationId) {
      navigate({ to: '/orgs' });
      return;
    }
    if (projectsLoading) return;

    const lastProjectId = localStorage.getItem('objectstack.lastProjectId');
    const targetProject =
      (lastProjectId && projects.find((p) => p.id === lastProjectId)) ||
      projects.find((p) => p.isDefault) ||
      projects[0];

    if (targetProject) {
      navigate({
        to: '/projects/$projectId',
        params: { projectId: targetProject.id },
      });
    } else {
      navigate({ to: '/projects' });
    }
  }, [user, session, sessionLoading, projects, projectsLoading, navigate]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: IndexRedirect,
});
