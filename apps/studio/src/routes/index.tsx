// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import { useProjects } from '@/hooks/useProjects';
import { config } from '@/lib/config';
import { PLATFORM_PROJECT_ID } from '@/lib/platform-project';

function IndexRedirect() {
  const navigate = useNavigate();
  const { user, session, loading: sessionLoading } = useSession();
  const { projects, loading: projectsLoading } = useProjects();

  useEffect(() => {
    // Single-project (local dev) mode: there is no org/project picker and
    // no per-project control plane; route straight to the platform metadata
    // view, which renders the unified registry of every loaded package.
    if (config.singleProject) {
      navigate({
        to: '/projects/$projectId',
        params: { projectId: PLATFORM_PROJECT_ID },
        replace: true,
      });
      return;
    }

    if (sessionLoading || !user) return; // RequireAuth sends to /login

    if (!session?.activeOrganizationId) {
      navigate({ to: '/organizations' });
      return;
    }
    if (projectsLoading) return;

    const lastProjectId = localStorage.getItem('objectstack.lastProjectId');
    const targetProject =
      (lastProjectId && projects.find((p) => p.id === lastProjectId)) ||
      projects.find((p) => p.is_default) ||
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
