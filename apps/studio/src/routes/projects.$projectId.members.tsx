// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId/members — project Members tab.
 *
 * Surfaces invite + role-management UI for the active project. The
 * underlying MembersPanel handles list rendering, invite dialog,
 * role popover and remove-member confirmation.
 */

import { createFileRoute, useParams } from '@tanstack/react-router';
import { ProjectHeader } from '@/components/projects/project-header';
import { MembersPanel } from '@/components/projects/members-panel';
import { useProjectDetail } from '@/hooks/useProjects';
import { isPlatformProject } from '@/lib/platform-project';

function ProjectMembersComponent() {
  const { projectId } = useParams({ from: '/projects/$projectId/members' });
  if (isPlatformProject(projectId)) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background p-12 text-sm text-muted-foreground">
        Member management is not available for the platform project.
      </main>
    );
  }

  const { detail, loading, reload } = useProjectDetail(projectId);
  const project = detail?.project;

  if (loading && !project) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }
  if (!project) return null;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">
      <ProjectHeader
        projectId={projectId}
        project={project}
        detail={detail}
        onReload={reload}
        loading={loading}
        active="members"
      />
      <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
        <MembersPanel
          projectId={projectId}
          callerRole={detail?.membership?.role}
        />
      </div>
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/members')({
  component: ProjectMembersComponent,
});
