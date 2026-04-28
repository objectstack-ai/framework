// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Organization → General — editable details (owner/admin only) plus the
 * danger zone.
 *
 * Permission model: only members with role `owner` or `admin` can edit
 * the name/slug/logo or delete the organization. The form is rendered
 * read-only for everyone else; the server still enforces the same rule.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  useOrganizations,
  useSession,
  useDeleteOrganization,
  useUpdateOrganization,
} from '@/hooks/useSession';
import { useOrganizationMembers, useOrganizationInvitations } from '@/hooks/useOrganizationMembers';

export const Route = createFileRoute('/organizations/$orgId/general')({
  component: OrgGeneralPage,
});

function OrgGeneralPage() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const { organizations } = useOrganizations();
  const { session, user, setActiveOrganization } = useSession();
  const org = organizations.find((o) => o.id === orgId);
  const { members } = useOrganizationMembers(orgId);
  const { invitations } = useOrganizationInvitations(orgId);
  const { remove: deleteOrganization, deleting: deletingOrg } = useDeleteOrganization();
  const { update: updateOrganization, updating } = useUpdateOrganization();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Hydrate the edit form whenever the org snapshot changes.
  useEffect(() => {
    setName(org?.name ?? '');
    setSlug(org?.slug ?? '');
    setLogo(org?.logo ?? '');
  }, [org?.id, org?.name, org?.slug, org?.logo]);

  const isActive = session?.activeOrganizationId === orgId;
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  // Permission check — derived from the members list.
  const myMembership = user ? members.find((m) => m.userId === user.id) : undefined;
  const myRole = myMembership?.role ?? null;
  const canEdit = myRole === 'owner' || myRole === 'admin';

  const dirty =
    canEdit &&
    org != null &&
    (name.trim() !== (org.name ?? '') ||
      slug.trim() !== (org.slug ?? '') ||
      logo.trim() !== (org.logo ?? ''));

  const handleSetActive = async () => {
    try {
      await setActiveOrganization(orgId);
      toast({ title: 'Organization switched' });
    } catch (err) {
      toast({
        title: 'Failed to switch',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!org || !canEdit || !dirty) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: 'Name is required',
        variant: 'destructive',
      });
      return;
    }
    try {
      await updateOrganization(orgId, {
        name: trimmedName,
        slug: slug.trim() || undefined,
        logo: logo.trim() || undefined,
      });
      toast({ title: 'Organization updated' });
    } catch (err) {
      toast({
        title: 'Failed to update organization',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setName(org?.name ?? '');
    setSlug(org?.slug ?? '');
    setLogo(org?.logo ?? '');
  };

  const handleDelete = async () => {
    if (!org) return;
    if (deleteConfirmText !== org.name) {
      toast({
        title: 'Confirmation does not match',
        description: `Type "${org.name}" to confirm deletion.`,
        variant: 'destructive',
      });
      return;
    }
    try {
      const result = await deleteOrganization(orgId);
      const warnings = (result as any)?.warnings as string[] | undefined;
      const deletedProjects = (result as any)?.deletedProjects ?? 0;
      toast({
        title: 'Organization deleted',
        description: warnings?.length
          ? `Removed ${deletedProjects} project(s). Warnings: ${warnings[0]}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}`
          : `${org.name} and ${deletedProjects} project(s) (with their databases) have been removed.`,
        variant: warnings?.length ? 'destructive' : undefined,
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
      navigate({ to: '/organizations' });
    } catch (err) {
      toast({
        title: 'Failed to delete organization',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isActive && <Badge variant="outline">Active</Badge>}
          {myRole && (
            <Badge variant="secondary" className="capitalize">
              {myRole}
            </Badge>
          )}
        </div>
        {!isActive && (
          <Button size="sm" variant="outline" onClick={handleSetActive}>
            Set as active
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            {canEdit
              ? 'Update your organization’s display name, URL slug, and logo.'
              : 'Only owners and admins can edit these details.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || updating}
              placeholder="Acme Inc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={!canEdit || updating}
              placeholder="acme"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase, dash-separated. Used in URLs and invitations.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-logo">Logo URL</Label>
            <Input
              id="org-logo"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              disabled={!canEdit || updating}
              placeholder="https://…"
            />
          </div>
          <div className="flex justify-between border-t pt-4 text-xs">
            <span className="text-muted-foreground">Organization ID</span>
            <code className="font-mono">{orgId}</code>
          </div>
        </CardContent>
        {canEdit && (
          <CardContent className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={!dirty || updating}
            >
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || updating}>
              <Save className="mr-2 h-4 w-4" />
              {updating ? 'Saving…' : 'Save changes'}
            </Button>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At a glance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Members</span>
            <span>{members.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pending invitations</span>
            <span>{pendingInvitations.length}</span>
          </div>
        </CardContent>
      </Card>

      {canEdit && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Permanently delete this organization, all of its projects, and every project's
              underlying database. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deletingOrg}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete organization
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmText('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete organization</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{org?.name}</strong>, all of its
              projects, and every project's underlying database. Members and pending
              invitations will be removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                Type <code className="font-mono text-xs">{org?.name}</code> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={org?.name ?? ''}
                disabled={deletingOrg}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingOrg}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deletingOrg || !org || deleteConfirmText !== org.name}
            >
              {deletingOrg ? 'Deleting…' : 'Delete organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
