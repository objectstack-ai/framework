// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /account/oauth-applications — list of OAuth apps registered by the
 * current user (when ObjectStack is acting as an OIDC provider).
 */

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  useOAuthApplications,
  useDeleteOAuthApplication,
  type OAuthApplication,
} from '@/hooks/useOAuthApplications';

export const Route = createFileRoute('/account/oauth-applications/')({
  component: OAuthApplicationsListPage,
});

function OAuthApplicationsListPage() {
  const navigate = useNavigate();
  const { applications, loading, reload } = useOAuthApplications();
  const { remove, deleting } = useDeleteOAuthApplication();
  const [pendingDelete, setPendingDelete] = useState<OAuthApplication | null>(null);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.client_id);
      toast({ title: 'OAuth application deleted' });
      setPendingDelete(null);
      await reload();
    } catch (err) {
      toast({
        title: 'Failed to delete',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">OAuth Applications</h1>
          <p className="text-sm text-muted-foreground">
            Register applications to authenticate users via this server's
            OpenID Connect identity provider.
          </p>
        </div>
        <Button onClick={() => navigate({ to: '/account/oauth-applications/new' })}>
          <Plus className="mr-2 h-4 w-4" />
          New application
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading…
          </CardContent>
        </Card>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <KeyRound className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No OAuth applications yet</p>
              <p className="text-sm text-muted-foreground">
                Register an application to start integrating SSO.
              </p>
            </div>
            <Button onClick={() => navigate({ to: '/account/oauth-applications/new' })}>
              <Plus className="mr-2 h-4 w-4" />
              Register an application
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {applications.map((app) => (
            <Card key={app.id} className="cursor-pointer hover:bg-accent/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to="/account/oauth-applications/$clientId"
                    params={{ clientId: app.client_id }}
                    className="flex flex-1 items-center gap-3"
                  >
                    <div className="rounded-md border bg-background p-2">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{app.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {app.client_id}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {app.type}
                    </Badge>
                    {app.disabled && <Badge variant="destructive">Disabled</Badge>}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPendingDelete(app);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OAuth application?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{pendingDelete?.name}</strong>.
              All access tokens and consents associated with this client will
              also be revoked. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
