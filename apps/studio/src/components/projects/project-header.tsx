// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ProjectHeader — GitHub/Vercel-style project page header.
 *
 * Renders breadcrumb, title row with status / visibility, and a tab bar
 * that links to the project's primary surfaces:
 *   Overview · Revisions · Packages · Members · Settings
 *
 * Used by every top-level project route so the header is consistent and
 * the user can switch surfaces without jumping back to a hub.
 */

import { Link } from '@tanstack/react-router';
import {
  Building2,
  ChevronRight,
  Copy,
  Eye,
  History,
  Layers,
  Lock,
  Package,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { toast } from '@/hooks/use-toast';
import type {
  ProjectDetail,
  ProjectRow,
} from '@/hooks/useProjects';

export type ProjectTabKey =
  | 'overview'
  | 'revisions'
  | 'packages'
  | 'members'
  | 'settings';

interface Props {
  projectId: string;
  project: ProjectRow;
  detail: ProjectDetail | null | undefined;
  /** Optional refresh handler; renders the Refresh button when provided. */
  onReload?: () => void;
  loading?: boolean;
  /** Active tab — drives underline highlight. */
  active: ProjectTabKey;
  /** Extra controls rendered in the title-row right-side. */
  rightSlot?: ReactNode;
}

const TABS: Array<{ key: ProjectTabKey; label: string; icon: typeof Eye; to: string }> = [
  { key: 'overview', label: 'Overview', icon: Layers, to: '/projects/$projectId' },
  { key: 'revisions', label: 'Revisions', icon: History, to: '/projects/$projectId/revisions' },
  { key: 'packages', label: 'Packages', icon: Package, to: '/projects/$projectId/packages' },
  { key: 'members', label: 'Members', icon: Users, to: '/projects/$projectId/members' },
  { key: 'settings', label: 'Settings', icon: Settings, to: '/projects/$projectId/settings' },
];

function VisibilityBadge({ visibility }: { visibility: 'private' | 'public' }) {
  const variant = visibility === 'public' ? 'default' : 'outline';
  return (
    <Badge
      variant={variant}
      className="gap-1 text-xs"
      title={
        visibility === 'public'
          ? 'Public — listed and freely downloadable.'
          : 'Private — share-by-link. Anonymous downloads need an exact ?commit=.'
      }
    >
      {visibility === 'public' ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {visibility}
    </Badge>
  );
}

export function ProjectHeader({
  projectId,
  project,
  detail,
  onReload,
  loading,
  active,
  rightSlot,
}: Props) {
  const visibilityRaw = ((project as any)?.visibility ?? 'private') as string;
  const visibility: 'private' | 'public' = visibilityRaw === 'public' ? 'public' : 'private';

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(project.id);
      toast({ title: 'Project ID copied', description: project.id });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="border-b bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 pt-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {detail?.organization && (
            <>
              <Building2 className="h-3.5 w-3.5" />
              <span>{detail.organization.displayName ?? detail.organization.name}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <Link to="/projects" className="hover:text-foreground">
            Projects
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{project.display_name}</span>
        </div>

        {/* Title row */}
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {project.display_name}
              </h1>
              {project.is_default && <Badge variant="outline">default</Badge>}
              <ProjectStatusBadge status={(project.status ?? 'provisioning') as any} />
              <VisibilityBadge visibility={visibility} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{project.id}</code>
              <button
                type="button"
                onClick={copyId}
                className="inline-flex items-center gap-1 rounded p-1 hover:bg-muted hover:text-foreground"
                title="Copy project ID"
              >
                <Copy className="h-3 w-3" />
              </button>
              <span>·</span>
              <span>Plan {project.plan ?? 'free'}</span>
              {project.created_at && (
                <>
                  <span>·</span>
                  <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onReload && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
                disabled={loading}
                className="gap-2"
                title="Refresh project status"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
            {rightSlot}
          </div>
        </div>

        {/* Tab bar */}
        <nav className="mt-4 -mb-px flex flex-wrap gap-0 overflow-x-auto" aria-label="Project sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === active;
            return (
              <Link
                key={tab.key}
                to={tab.to}
                params={{ projectId }}
                className={[
                  'group inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
