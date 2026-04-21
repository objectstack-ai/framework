// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects — project list & management page.
 *
 * Entry point for the project administration flows: lists every
 * project visible to the current session, groups them by projectType,
 * and surfaces one-click navigation into each project's overview
 * (`/projects/:projectId`).
 *
 * Provisioning new projects is handled by {@link NewProjectDialog}
 * exposed via the "New project" button.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, Database, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProjectBadge } from '@/components/project-badge';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { useProjects } from '@/hooks/useProjects';

function ProjectsListComponent() {
  const navigate = useNavigate();
  const { projects, loading, reload } = useProjects();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Projects</h1>
              <p className="text-sm text-muted-foreground">
                Each project has a physically isolated database. Switch
                between them from the header at any time.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New project
            </Button>
          </div>

          <div className="mb-3 flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reload()}
              disabled={loading}
              className="gap-2"
              title="Refresh the project list (does not auto-poll)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}

          {!loading && projects.length === 0 && (
            <Card className="p-10 text-center">
              <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h3 className="text-base font-medium">No projects yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first project to start building.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create project
              </Button>
            </Card>
          )}

          <div className="grid gap-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate({
                    to: '/projects/$projectId',
                    params: { projectId: project.id },
                  })
                }
                className="cursor-pointer p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-medium">
                        {project.displayName}
                      </h3>
                      <ProjectBadge projectType={project.projectType} />
                      {project.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          default
                        </Badge>
                      )}
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="font-mono">{project.slug}</code>
                      {project.region && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {project.region}
                        </span>
                      )}
                      <code className="font-mono opacity-60">{project.id}</code>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <NewProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (project) => {
          await reload();
          navigate({
            to: '/projects/$projectId',
            params: { projectId: project.id },
          });
        }}
      />
    </main>
  );
}

export const Route = createFileRoute('/projects/')({
  component: ProjectsListComponent,
});
