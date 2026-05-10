// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId/revisions — published artifact revision history.
 *
 * Lists every `sys_project_revision` row for the project (newest first),
 * surfaces the current commit, and lets the operator:
 *   - copy a download URL for the artifact (public `/pub/v1` if visibility
 *     allows, otherwise auth-gated `/api/v1/cloud/...`),
 *   - activate (rollback to) a previous revision,
 *   - open a "preview" tab against the chosen commit.
 */

import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, RotateCcw, Loader2, Eye } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useProjectDetail,
  useRevisions,
  useActivateRevision,
} from '@/hooks/useProjects';
import { toast } from '@/hooks/use-toast';

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function ProjectRevisionsComponent() {
  const { projectId } = useParams({ from: '/projects/$projectId/revisions' });
  const { detail } = useProjectDetail(projectId);
  const { items, loading, reload } = useRevisions(projectId);
  const { activate, activating } = useActivateRevision();
  const [pendingCommit, setPendingCommit] = useState<string | null>(null);

  const project = detail?.project;
  const visibility = (project as any)?.visibility ?? 'private';
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const currentCommit = useMemo(
    () => items.find((r) => r.isCurrent)?.commitId ?? null,
    [items],
  );

  const buildArtifactUrl = (commitId: string): string => {
    if (visibility === 'public' || visibility === 'unlisted') {
      return `${baseOrigin}/api/v1/pub/v1/projects/${encodeURIComponent(projectId)}/artifact?commit=${encodeURIComponent(commitId)}`;
    }
    return `${baseOrigin}/api/v1/cloud/projects/${encodeURIComponent(projectId)}/artifact?commit=${encodeURIComponent(commitId)}`;
  };

  const handleCopyUrl = async (commitId: string) => {
    const url = buildArtifactUrl(commitId);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Artifact URL copied', description: url });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleActivate = async (commitId: string) => {
    setPendingCommit(commitId);
    try {
      await activate(projectId, commitId);
      toast({
        title: 'Revision activated',
        description: `Project now serves commit ${commitId.slice(0, 12)}.`,
      });
      await reload();
    } catch (err) {
      toast({
        title: 'Activation failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPendingCommit(null);
    }
  };

  const handlePreview = (commitId: string) => {
    const url = buildArtifactUrl(commitId);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects/$projectId" params={{ projectId }}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Published revisions</h1>
              <p className="text-xs text-muted-foreground">
                {project?.display_name ?? projectId}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Visibility: {visibility}
            </Badge>
            {currentCommit && (
              <Badge variant="secondary" className="font-mono text-xs">
                Current: {currentCommit.slice(0, 12)}
              </Badge>
            )}
          </div>
        </div>

        {loading ? (
          <Card className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading revisions…
          </Card>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center text-sm text-muted-foreground">
            <p className="mb-2">No published revisions yet.</p>
            <p className="text-xs">
              Run <code className="font-mono">objectstack publish</code> from
              your project directory to create the first revision.
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Commit</th>
                    <th className="px-4 py-3 text-left font-medium">Size</th>
                    <th className="px-4 py-3 text-left font-medium">Built</th>
                    <th className="px-4 py-3 text-left font-medium">By</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((r) => {
                    const isPending = pendingCommit === r.commitId && activating;
                    return (
                      <tr key={r.commitId} className="hover:bg-muted/20">
                        <td className="px-4 py-3 align-top">
                          <code
                            className="cursor-pointer font-mono text-xs"
                            title={r.commitId}
                            onClick={() => handleCopyUrl(r.commitId)}
                          >
                            {r.commitId.slice(0, 16)}…
                          </code>
                          {r.note && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {r.note}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                          {formatBytes(r.sizeBytes)}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                          {new Date(r.builtAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                          {r.publishedBy ?? '—'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {r.isCurrent ? (
                            <Badge variant="default" className="text-xs">current</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">archived</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyUrl(r.commitId)}
                              title="Copy artifact URL"
                              className="h-8 w-8 p-0"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(r.commitId)}
                              title="Preview artifact JSON"
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {!r.isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleActivate(r.commitId)}
                                disabled={isPending}
                                className="gap-1 text-xs"
                              >
                                {isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                Activate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {visibility === 'private' && (
          <p className="text-xs text-muted-foreground">
            This project is <strong>private</strong> — artifact URLs require an
            authenticated session. Switch visibility to <code>unlisted</code> or{' '}
            <code>public</code> from the project page to enable share links via{' '}
            <code className="font-mono">/api/v1/pub/v1/...</code>.
          </p>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/revisions')({
  component: ProjectRevisionsComponent,
});
