// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId — project Overview tab.
 *
 * Default landing surface when the user selects a project. Shows a
 * high-level summary: stats, endpoints, recent revisions, database
 * provisioning state, status banners. Member management, settings, and
 * destructive actions live on their own tabs.
 */

import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  Database,
  RotateCw,
  AlertTriangle,
  Loader2,
  Globe,
  History,
  Copy,
  GitCommit,
  Server,
  ExternalLink,
  ChevronRight,
  Layers,
  Terminal,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectHeader } from '@/components/projects/project-header';
import {
  useProjectDetail,
  useRetryProvisioning,
  useRevisions,
  useProjectMembers,
} from '@/hooks/useProjects';
import { useEnvAwarePackages } from '@/hooks/useProjectAwarePackages';
import { toast } from '@/hooks/use-toast';
import { isPlatformProject } from '@/lib/platform-project';
import { PlatformOverview } from '@/components/platform-overview';

function ProjectOverviewComponent() {
  const { projectId } = useParams({
    from: '/projects/$projectId',
  });
  if (isPlatformProject(projectId)) {
    return <PlatformOverview />;
  }
  return <RealProjectOverview projectId={projectId} />;
}

function RealProjectOverview({ projectId }: { projectId: string }) {
  const { detail, loading, reload } = useProjectDetail(projectId);
  const { items: revisions, loading: revisionsLoading } = useRevisions(projectId);
  const { items: members } = useProjectMembers(projectId);
  const { packages } = useEnvAwarePackages(projectId);
  const navigate = useNavigate();
  const { retry, retrying } = useRetryProvisioning();

  const project = detail?.project;
  const provisioningError =
    (project?.metadata as Record<string, any> | undefined)?.provisioningError as
      | { message?: string; failedAt?: string }
      | undefined;
  const visibilityRaw = ((project as any)?.visibility ?? 'private') as string;
  const visibility = (visibilityRaw === 'unlisted' ? 'private' : visibilityRaw) as
    | 'private'
    | 'public';
  const currentRevision = useMemo(
    () => revisions.find((r) => r.isCurrent) ?? revisions[0] ?? null,
    [revisions],
  );
  const recentRevisions = revisions.slice(0, 5);
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiBase = `${baseOrigin}/api/v1`;
  const studioUrl = `${baseOrigin}/_studio/projects/${projectId}`;
  const publicArtifactUrl =
    visibility === 'public'
      ? `${baseOrigin}/api/v1/pub/v1/projects/${projectId}/artifact`
      : currentRevision?.commitId
        ? `${baseOrigin}/api/v1/pub/v1/projects/${projectId}/artifact?commit=${currentRevision.commitId}`
        : null;
  const cliPublishCmd = `OS_CLOUD_URL=${baseOrigin} OS_PROJECT_ID=${projectId} objectstack publish`;

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: value });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleRetry = async () => {
    if (!project) return;
    try {
      const result = await retry(project.id);
      const nextStatus = (result as any)?.project?.status;
      if (nextStatus === 'active') {
        toast({
          title: 'Provisioning complete',
          description: 'The project is now active and ready to use.',
        });
      } else if (nextStatus === 'failed') {
        toast({
          title: 'Retry failed',
          description:
            (result as any)?.project?.metadata?.provisioningError?.message ??
            'Provisioning failed again. Check server logs.',
          variant: 'destructive',
        });
      }
      await reload();
    } catch (err) {
      toast({
        title: 'Retry failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

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
        active="overview"
      />

      <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
        {/* Status banners */}
        {project.status === 'provisioning' && (
          <Card className="flex items-start gap-3 border-sky-500/40 bg-sky-500/5 p-4">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-sky-700 dark:text-sky-300">
                Provisioning in progress
              </p>
              <p className="text-muted-foreground">
                We&rsquo;re allocating the physical database and minting credentials. This
                normally takes a few seconds — click Refresh to check the latest status.
              </p>
            </div>
          </Card>
        )}

        {project.status === 'failed' && (
          <Card className="flex items-start gap-3 border-red-500/40 bg-red-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-red-700 dark:text-red-300">
                Provisioning failed
              </p>
              <p className="text-muted-foreground">
                {provisioningError?.message ??
                  'The project could not be provisioned. Retry to run the driver handshake again.'}
              </p>
              {provisioningError?.failedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last attempt: {new Date(provisioningError.failedAt).toLocaleString()}
                </p>
              )}
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="gap-2"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Retrying…' : 'Retry provisioning'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* At-a-glance stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <GitCommit className="h-3.5 w-3.5" />
              Current commit
            </div>
            <div className="mt-2 truncate font-mono text-sm font-medium">
              {currentRevision ? currentRevision.commitId.slice(0, 12) : '—'}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {currentRevision?.publishedAt
                ? `Published ${new Date(currentRevision.publishedAt).toLocaleDateString()}`
                : 'No artifact published yet'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Visibility
            </div>
            <div className="mt-2 text-sm font-medium capitalize">{visibility}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {visibility === 'public'
                ? 'Listed & freely downloadable'
                : 'Share-by-link (anon needs ?commit=)'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Members
            </div>
            <div className="mt-2 text-sm font-medium">
              {members.length || (detail?.membership ? 1 : '—')}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {detail?.membership?.role
                ? `Your role: ${detail.membership.role}`
                : detail?.organization
                ? `In ${detail.organization.displayName ?? detail.organization.name}`
                : 'Membership unavailable'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Packages
            </div>
            <div className="mt-2 text-sm font-medium">{packages.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {packages.length === 0 ? 'None installed' : 'Installed in this project'}
            </div>
          </Card>
        </div>

        {/* Two-column body */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left — operational data */}
          <div className="space-y-6 lg:col-span-2">
            {/* Recent revisions */}
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  Recent revisions
                </h2>
                <Link
                  to="/projects/$projectId/revisions"
                  params={{ projectId: project.id }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  View all
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {revisionsLoading && recentRevisions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading revisions…</p>
              ) : recentRevisions.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">No artifacts published yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use the CLI command below to publish your first artifact.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRevisions.map((r) => (
                    <div
                      key={r.commitId}
                      className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm">{r.commitId.slice(0, 12)}</code>
                          {r.isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">current</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {r.publishedBy ? `${r.publishedBy} · ` : ''}
                          {r.publishedAt ? new Date(r.publishedAt).toLocaleString() : '—'}
                          {r.note ? ` · ${r.note}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(r.commitId, 'Commit ID')}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Copy commit ID"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Endpoints */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                Endpoints
              </h2>
              <div className="space-y-2.5">
                <UrlRow
                  label="Studio"
                  value={studioUrl}
                  onCopy={() => copyToClipboard(studioUrl, 'Studio URL')}
                />
                <UrlRow
                  label="API base"
                  value={apiBase}
                  onCopy={() => copyToClipboard(apiBase, 'API base URL')}
                />
                {publicArtifactUrl && (
                  <UrlRow
                    label="Public artifact"
                    value={publicArtifactUrl}
                    onCopy={() => copyToClipboard(publicArtifactUrl, 'Public artifact URL')}
                    external
                  />
                )}
                <div className="rounded-md border bg-muted/40 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Terminal className="h-3.5 w-3.5" />
                      Publish from CLI
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(cliPublishCmd, 'Publish command')}
                      className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Copy command"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <code className="block break-all font-mono text-xs">{cliPublishCmd}</code>
                </div>
              </div>
            </Card>
          </div>

          {/* Right — meta */}
          <div className="space-y-6">
            {/* Project info */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                Project info
              </h2>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="font-medium capitalize">{project.plan ?? 'free'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{project.created_at ? new Date(project.created_at).toLocaleDateString() : '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd>{project.updated_at ? new Date(project.updated_at).toLocaleDateString() : '—'}</dd>
                </div>
                {detail?.organization && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Organization</dt>
                    <dd className="truncate font-medium">
                      {detail.organization.displayName ?? detail.organization.name}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Database */}
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                Database
              </h2>
              {detail?.database ? (
                <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Driver</dt>
                  <dd>
                    <code className="font-mono">{detail.database.driver}</code>
                  </dd>
                  <dt className="text-muted-foreground">Physical</dt>
                  <dd>
                    <code className="break-all font-mono text-xs">{detail.database.database_name}</code>
                  </dd>
                  <dt className="text-muted-foreground">Quota</dt>
                  <dd>
                    {detail.database.storage_limit_mb && detail.database.storage_limit_mb > 0
                      ? `${detail.database.storage_limit_mb} MB`
                      : 'Unlimited'}
                  </dd>
                  {detail.database.provisioned_at && (
                    <>
                      <dt className="text-muted-foreground">Provisioned</dt>
                      <dd className="text-xs">
                        {new Date(detail.database.provisioned_at).toLocaleString()}
                      </dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Database is still provisioning…</p>
              )}
            </Card>

            {/* Domains preview */}
            <Card className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  Domain
                </h2>
                <Link
                  to="/projects/$projectId/settings"
                  params={{ projectId: project.id }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {project.hostname ? (
                <code className="break-all font-mono text-sm">{project.hostname}</code>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No custom hostname bound. Set one in Settings.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectOverviewComponent,
});

function UrlRow({
  label,
  value,
  onCopy,
  external,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  external?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
      <div className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{label}</div>
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      {external && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
