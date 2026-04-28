// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { GalleryVerticalEnd } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/accept-invitation/$invitationId')({
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const { reloadOrganizations } = useSession();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const res = await fetch('/api/v1/auth/organization/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invitationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      await reloadOrganizations().catch(() => {});
      toast({ title: 'Invitation accepted' });
      navigate({ to: '/organizations' });
    } catch (err) {
      toast({
        title: 'Failed to accept invitation',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch('/api/v1/auth/organization/reject-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invitationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || `Request failed: ${res.status}`);
      }
      toast({ title: 'Invitation declined' });
      navigate({ to: '/organizations' });
    } catch (err) {
      toast({
        title: 'Failed to decline invitation',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEnd className="size-4" />
          </div>
          ObjectStack
        </a>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Organization invitation</CardTitle>
            <CardDescription>
              You have been invited to join an organization. Accept or decline below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={accepting || rejecting}
            >
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReject}
              disabled={accepting || rejecting}
            >
              {rejecting ? 'Declining…' : 'Decline'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
