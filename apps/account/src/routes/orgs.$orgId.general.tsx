// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Organization → General — name, slug, ID, plus the danger zone.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
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
import { useOrganizations, useSession, useDeleteOrganization } from '@/hooks/useSession';
import { useOrganizationMembers, useOrganizationInvitations } from '@/hooks/useOrganizationMembers';

export const Route = createFileRoute('/orgs/$orgId/general')({
  component: OrgGeneralPage,
});

function OrgGeneralPage() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const { organizations } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const org = organizations.find((o) => o.id === orgId);
  const { members } = useOrganizationMembers(orgId);
  const { invitations } = useOrganizationInvitations(orgId);
  const { remove: deleteOrganization, deleting: deletingOrg } = useDeleteOrganization();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isActive = session?.activeOrganizationId === orgId;
  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

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
      navigate({ to: '/orgs' });
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
      <div className="flex items-center justify-end">
        {!isActive && (
          <Button size="sm" onClick={handleSetActive}>
            Set as active
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{org?.name ?? 'Organization'}</CardTitle>
              {org?.slug && (
                <CardDescription className="font-mono text-xs mt-1">
                  {org.slug}
                </CardDescription>
              )}
            </div>
            {isActive && (
              <Badge variant="outline" className="ml-2">
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID</span>
            <code className="text-xs">{orgId}</code>
          </div>
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
