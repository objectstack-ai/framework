// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId/settings — project Settings tab.
 *
 * Houses the editable knobs and destructive operations:
 *   - General: visibility, custom hostname
 *   - Credential: status + rotation
 *   - Danger zone: typed-confirmation deletion
 */

import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Globe,
  KeyRound,
  AlertTriangle,
  Loader2,
  Pencil,
  Check,
  X,
  Trash,
  RefreshCw,
  ShieldCheck,
  Eye,
  Lock,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectHeader } from '@/components/projects/project-header';
import {
  useProjectDetail,
  useUpdateHostname,
  useUpdateVisibility,
  useDeleteProject,
} from '@/hooks/useProjects';
import { useClient } from '@objectstack/client-react';
import { useProductionGuard } from '@/components/production-guard';
import { toast } from '@/hooks/use-toast';
import { isPlatformProject } from '@/lib/platform-project';

function ProjectSettingsComponent() {
  const { projectId } = useParams({ from: '/projects/$projectId/settings' });
  if (isPlatformProject(projectId)) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background p-12 text-sm text-muted-foreground">
        Settings are not available for the platform project.
      </main>
    );
  }
  return <RealProjectSettings projectId={projectId} />;
}

function RealProjectSettings({ projectId }: { projectId: string }) {
  const { detail, loading, reload } = useProjectDetail(projectId);
  const navigate = useNavigate();
  const client = useClient() as any;
  const guard = useProductionGuard();
  const { updateHostname, updating: hostnameUpdating } = useUpdateHostname();
  const { updateVisibility, updating: visibilityUpdating } = useUpdateVisibility();
  const { remove: deleteProject, deleting } = useDeleteProject();

  const [hostnameEditing, setHostnameEditing] = useState(false);
  const [hostnameInput, setHostnameInput] = useState('');
  const [rotating, setRotating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const project = detail?.project;
  if (loading && !project) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }
  if (!project) return null;

  const visibilityRaw = ((project as any)?.visibility ?? 'private') as string;
  const visibility: 'private' | 'public' = visibilityRaw === 'public' ? 'public' : 'private';

  const handleVisibilityChange = async (next: string) => {
    const v = next as 'private' | 'public';
    if (v === visibility) return;
    try {
      await updateVisibility(project.id, v);
      toast({ title: 'Visibility updated', description: `Project is now ${v}.` });
      await reload();
    } catch (err) {
      toast({
        title: 'Update failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleHostnameSave = async () => {
    try {
      await updateHostname(project.id, hostnameInput);
      toast({ title: 'Hostname updated', description: `Bound to ${hostnameInput}` });
      setHostnameEditing(false);
      await reload();
    } catch (err) {
      toast({
        title: 'Failed to update hostname',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleRotate = async () => {
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
    <main className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">
      <ProjectHeader
        projectId={projectId}
        project={project}
        detail={detail}
        onReload={reload}
        loading={loading}
        active="settings"
      />

      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        {/* Visibility */}
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Visibility
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <p className="text-sm">
                <Badge variant={visibility === 'public' ? 'default' : 'outline'} className="gap-1">
                  {visibility === 'public' ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {visibility}
                </Badge>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {visibility === 'public'
                  ? 'Listed in the public gallery; anyone can download the current artifact from /pub/v1.'
                  : 'Hidden from enumeration. Anyone with the exact URL (including ?commit=) can still download anonymously (share-by-link). Members keep full authenticated access.'}
              </p>
            </div>
            <Select
              value={visibility}
              onValueChange={handleVisibilityChange}
              disabled={visibilityUpdating}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Domains */}
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              Custom domain
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
                className="h-9 font-mono text-sm"
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                placeholder="my-project.example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleHostnameSave();
                  if (e.key === 'Escape') setHostnameEditing(false);
                }}
              />
              <Button
                size="sm"
                variant="default"
                onClick={handleHostnameSave}
                disabled={hostnameUpdating}
                className="gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHostnameEditing(false)}
                className="gap-1"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : project.hostname ? (
            <code className="break-all font-mono text-sm">{project.hostname}</code>
          ) : (
            <p className="text-sm text-muted-foreground">
              No custom hostname bound. Click <span className="font-medium">Edit</span> to set one.
            </p>
          )}
        </Card>

        {/* Credential */}
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
              <RefreshCw className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`} />
              Rotate
            </Button>
          </div>
          {detail?.credential ? (
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant="secondary">{detail.credential.status}</Badge>
              </dd>
              <dt className="text-muted-foreground">Credential ID</dt>
              <dd>
                <code className="break-all font-mono text-xs">{detail.credential.id}</code>
              </dd>
              {detail.credential.activatedAt && (
                <>
                  <dt className="text-muted-foreground">Activated</dt>
                  <dd className="text-xs">
                    {new Date(detail.credential.activatedAt).toLocaleString()}
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No credential metadata available.</p>
          )}
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/40 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger zone
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">Delete this project</p>
              <p className="text-muted-foreground">
                Once deleted, the project, its credentials, members, package installations, and
                the underlying database are gone forever.
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
      </div>

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
              This action <strong>cannot be undone</strong>. This will permanently delete the{' '}
              <strong>{project.display_name}</strong> project, its credentials, members, package
              installations, and the underlying physical database.
            </DialogDescription>
          </DialogHeader>

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

          <div className="grid gap-1.5">
            <Label htmlFor="delete-project-confirm">
              Please type{' '}
              <code className="font-mono text-xs">{project.display_name}</code> to confirm.
            </Label>
            <Input
              id="delete-project-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={project.display_name}
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
              disabled={deleting || deleteConfirmText !== project.display_name}
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

export const Route = createFileRoute('/projects/$projectId/settings')({
  component: ProjectSettingsComponent,
});
