// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId — project overview (index).
 *
 * Default landing surface when the user selects a project. Shows a
 * snapshot of the project record: identity, database addressing,
 * membership, and the current active credential (metadata only, never
 * the ciphertext).
 */

import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Database,
  Users,
  KeyRound,
  MapPin,
  RefreshCw,
  RotateCw,
  Trash,
  AlertTriangle,
  Loader2,
  Package,
  Globe,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { ProjectStatusBadge } from '@/components/project-status-badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectDetail, useRetryProvisioning, useUpdateHostname, useDeleteProject } from '@/hooks/useProjects';
import { useClient } from '@objectstack/client-react';
import { useProductionGuard } from '@/components/production-guard';
import { toast } from '@/hooks/use-toast';

function ProjectOverviewComponent() {
  const { projectId } = useParams({
    from: '/projects/$projectId',
  });
  const { detail, loading, reload } = useProjectDetail(projectId);
  const client = useClient() as any;
  const navigate = useNavigate();
  const guard = useProductionGuard();
  const [rotating, setRotating] = useState(false);
  const { retry, retrying } = useRetryProvisioning();
  const { updateHostname, updating: hostnameUpdating } = useUpdateHostname();
  const { remove: deleteProject, deleting } = useDeleteProject();
  const [hostnameEditing, setHostnameEditing] = useState(false);
  const [hostnameInput, setHostnameInput] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const project = detail?.project;
  const provisioningError =
    (project?.metadata as Record<string, any> | undefined)?.provisioningError as
      | { message?: string; failedAt?: string }
      | undefined;

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

  const handleHostnameSave = async () => {
    if (!project) return;
    try {
      await updateHostname(project.id, hostnameInput);
      toast({ title: 'Hostname updated', description: `Bound to ${hostnameInput}` });
      setHostnameEditing(false);
      await reload();
    } catch (err) {
      toast({ title: 'Failed to update hostname', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleRotate = async () => {
    if (!project) return;
    const ok = await guard.confirm({
      title: 'Rotate production credential?',
      description:
        'A new credential will be issued and propagated to all runtimes. In-flight requests using the old credential may briefly fail until rollout completes.',
      confirmLabel: 'Rotate credential',
      confirmVariant: 'destructive',
      requireTypedConfirmation: true,
      typedConfirmationValue: project.display_name,
    });
    if (!ok) return;
    setRotating(true);
    try {
      const newToken =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tok_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await client?.projects?.rotateCredential?.(project.id, newToken);
      toast({
        title: 'Credential rotation started',
        description: 'The new credential will propagate to all runtimes.',
      });
    } catch (err) {
      toast({
        title: 'Rotation failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRotating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!project) return;
    if (deleteConfirmText !== project.display_name) {
      toast({
        title: 'Confirmation does not match',
        description: `Type "${project.display_name}" to confirm deletion.`,
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await deleteProject(project.id, { force: project.is_default });
      const warnings = (result as any)?.warnings as string[] | undefined;
      toast({
        title: 'Project deleted',
        description: warnings?.length
          ? `Completed with warnings: ${warnings[0]}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}`
          : `${project.display_name} and its database have been removed.`,
        variant: warnings?.length ? 'destructive' : undefined,
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
      navigate({ to: '/projects' });
    } catch (err) {
      toast({
        title: 'Failed to delete project',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
            {loading && !project && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}

            {project && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold">
                        {project.display_name}
                      </h1>
                      {project.is_default && (
                        <Badge variant="outline">default</Badge>
                      )}
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {project.id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reload()}
                      disabled={loading}
                      className="gap-2"
                      title="Refresh project status"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => navigate({
                        to: '/projects/$projectId/packages',
                        params: { projectId: project.id },
                      })}
                      disabled={project.status !== 'active'}
                    >
                      <Package className="h-4 w-4" />
                      Packages
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: '/projects' })}
                    >
                      Back to list
                    </Button>
                  </div>
                </div>

                {project.status === 'provisioning' && (
                  <Card className="flex items-start gap-3 border-sky-500/40 bg-sky-500/5 p-4">
                    <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-600" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-sky-700 dark:text-sky-300">
                        Provisioning in progress
                      </p>
                      <p className="text-muted-foreground">
                        We&rsquo;re allocating the physical database and
                        minting credentials for this project. This
                        normally takes a few seconds — click Refresh to
                        check the latest status.
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

                {false && project.status === 'active' && (
                  <Card className="flex items-start gap-3 border-red-500/40 bg-red-500/5 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="text-sm">
                      <p className="font-medium text-red-700 dark:text-red-300">
                        Live production project
                      </p>
                      <p className="text-muted-foreground">
                        Writes in this project affect real customer data.
                        Studio will prompt for confirmation before destructive
                        actions.
                      </p>
                    </div>
                  </Card>
                )}

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    Database
                  </h2>
                  {detail?.database ? (
                    <dl className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <dt className="text-muted-foreground">Driver</dt>
                      <dd>
                        <code className="font-mono">
                          {detail.database.driver}
                        </code>
                      </dd>
                      <dt className="text-muted-foreground">Region</dt>
                      <dd className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {detail.database.region}
                      </dd>
                      <dt className="text-muted-foreground">Physical name</dt>
                      <dd>
                        <code className="font-mono text-xs">
                          {detail.database.database_name}
                        </code>
                      </dd>
                      <dt className="text-muted-foreground">Storage quota</dt>
                      <dd>{detail.database.storage_limit_mb} MB</dd>
                      <dt className="text-muted-foreground">Provisioned</dt>
                      <dd>
                        {detail.database.provisioned_at
                          ? new Date(detail.database.provisioned_at).toLocaleString()
                          : '—'}
                      </dd>
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Database is still provisioning…
                    </p>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      Domains
                    </h2>
                    {!hostnameEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setHostnameInput(project.hostname ?? '');
                          setHostnameEditing(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {hostnameEditing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        className="h-8 font-mono text-sm"
                        value={hostnameInput}
                        onChange={(e) => setHostnameInput(e.target.value)}
                        placeholder="my-project.example.com"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleHostnameSave();
                          if (e.key === 'Escape') setHostnameEditing(false);
                        }}
                      />
                      <Button size="sm" variant="default" onClick={handleHostnameSave} disabled={hostnameUpdating} className="gap-1">
                        <Check className="h-3.5 w-3.5" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setHostnameEditing(false)} className="gap-1">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <dl className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <dt className="text-muted-foreground">Hostname</dt>
                      <dd>
                        {project.hostname
                          ? <code className="font-mono text-xs">{project.hostname}</code>
                          : <span className="text-muted-foreground">—</span>}
                      </dd>
                    </dl>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" />
                      Credential
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRotate}
                      disabled={rotating || project.status !== 'active'}
                      className="gap-2"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`}
                      />
                      Rotate
                    </Button>
                  </div>
                  {detail?.credential ? (
                    <dl className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <Badge variant="secondary">
                          {detail.credential.status}
                        </Badge>
                      </dd>
                      <dt className="text-muted-foreground">Credential ID</dt>
                      <dd>
                        <code className="font-mono text-xs">
                          {detail.credential.id}
                        </code>
                      </dd>
                      {detail.credential.activatedAt && (
                        <>
                          <dt className="text-muted-foreground">Activated</dt>
                          <dd>
                            {new Date(
                              detail.credential.activatedAt,
                            ).toLocaleString()}
                          </dd>
                        </>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No credential metadata available.
                    </p>
                  )}
                </Card>

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Your access
                  </h2>
                  {detail?.membership ? (
                    <div className="text-sm">
                      <p>
                        Role:{' '}
                        <Badge variant="outline" className="ml-1">
                          {detail.membership.role}
                        </Badge>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Membership info unavailable.
                    </p>
                  )}
                </Card>

                <Separator />

                {/* Danger zone — GitHub/Vercel-style cascade-delete card. */}
                <Card className="border-destructive/40 p-5">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Danger zone
                  </h2>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <p className="font-medium">Delete this project</p>
                      <p className="text-muted-foreground">
                        Once deleted, the project, its credentials, members, package
                        installations, and the underlying database are gone forever.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-2 self-start sm:self-auto"
                      disabled={deleting}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash className="h-3.5 w-3.5" />
                      Delete project
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Delete Project Dialog (GitHub/Vercel-style typed confirmation) */}
        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (deleting) return;
            setDeleteDialogOpen(open);
            if (!open) setDeleteConfirmText('');
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete project
              </DialogTitle>
              <DialogDescription>
                This action <strong>cannot be undone</strong>. This will permanently
                delete the <strong>{project?.display_name}</strong> project, its
                credentials, members, package installations, and the underlying
                physical database.
              </DialogDescription>
            </DialogHeader>

            {project && (
              <div className="my-2 space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{project.display_name}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">ID</span>
                  <code className="break-all font-mono">{project.id}</code>
                </div>
                {project.database_url && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Database</span>
                    <code className="break-all font-mono">{project.database_url}</code>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="delete-project-confirm">
                Please type{' '}
                <code className="font-mono text-xs">{project?.display_name}</code>{' '}
                to confirm.
              </Label>
              <Input
                id="delete-project-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={project?.display_name ?? ''}
                autoComplete="off"
                autoFocus
                disabled={deleting}
              />
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={
                  deleting ||
                  !project ||
                  deleteConfirmText !== project.display_name
                }
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'I understand, delete this project'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectOverviewComponent,
});
