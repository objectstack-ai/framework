// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ProjectSwitcher
 *
 * Power Platform-style project picker, anchored on the left of the
 * site header. Lists every project visible to the current session and
 * navigates to `/projects/:id/overview` when one is selected. Also
 * exposes a "+ New project…" footer that opens {@link NewProjectDialog}.
 *
 * The switcher is intentionally stateless with respect to the active
 * project — the URL is the source of truth, read via
 * `useParams({ strict: false })`. Persistence across reloads is handled
 * by `rememberActiveProject()` in `useProjects` and is replayed
 * by `useObjectStackClient` during initial client construction.
 *
 * @see docs/adr/0002-project-database-isolation.md
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ChevronsUpDown, Plus, Search, Check, Server } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProjects } from '@/hooks/useProjects';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { config } from '@/lib/config';

export function ProjectSwitcher() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { projectId?: string };
  const activeId = params.projectId;
  const isPlatform = activeId === 'platform';
  const { projects, loading, reload } = useProjects();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const active = useMemo(
    () => projects.find((e) => e.id === activeId) ?? null,
    [projects, activeId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (e) =>
        e.display_name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q),
    );
  }, [projects, search]);

  const handleSelect = (id: string) => {
    setOpen(false);
    setSearch('');
    navigate({
      to: '/projects/$projectId',
      params: { projectId: id },
    });
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 text-sm font-medium"
          >
            {isPlatform ? (
              <span className="flex items-center gap-1.5 max-w-[160px] truncate">
                <Server className="h-3 w-3 shrink-0" />
                Platform
              </span>
            ) : active ? (
              <span className="max-w-[160px] truncate">
                {active.display_name}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {loading ? 'Loading…' : 'Select project'}
              </span>
            )}
            <ChevronsUpDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[340px] p-0"
          sideOffset={4}
        >
          {!config.singleProject && (
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search projects…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
          )}

          <div className="max-h-[340px] overflow-y-auto py-1">
            {/* Platform — fixed system entry */}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setOpen(false);
                setSearch('');
                navigate({
                  to: '/projects/$projectId',
                  params: { projectId: 'platform' },
                });
              }}
              className="flex items-center gap-2"
            >
              <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 font-medium">Platform</span>
              <span className="text-[11px] text-muted-foreground">system</span>
              {isPlatform && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />

            {projects.length === 0 && !loading && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No projects yet.
              </div>
            )}
            {filtered.map((env) => (
              <DropdownMenuItem
                key={env.id}
                onSelect={(e) => {
                  e.preventDefault();
                  handleSelect(env.id);
                }}
                className="flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {env.display_name}
                    </span>
                    {env.is_default && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1 text-[9px]"
                      >
                        default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <code className="font-mono opacity-60">
                      {env.id.slice(0, 8)}
                    </code>
                    <span>· {env.status}</span>
                  </div>
                </div>
                {env.id === activeId && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </div>

          {!config.singleProject && (
            <>
              <DropdownMenuSeparator className="m-0" />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  setCreateOpen(true);
                }}
                className="gap-2 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                New project…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  navigate({ to: '/projects' });
                }}
                className="gap-2 text-sm text-muted-foreground"
              >
                Manage all projects
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  );
}
