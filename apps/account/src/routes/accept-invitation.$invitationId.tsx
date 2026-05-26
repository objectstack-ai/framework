// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/accept-invitation/$invitationId')({
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { t } = useObjectTranslation();
  const { invitationId } = Route.useParams();
  const navigate = useNavigate();
  const client = useClient() as any;
  const { user, loading: sessionLoading, reloadOrganizations } = useSession();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Anonymous users can't accept — bounce to /login with a return URL so
  // they come back here once authenticated. Without this, the POST below
  // 401s and the user gets a confusing toast.
  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      const next = `/accept-invitation/${invitationId}`;
      navigate({ to: '/login', search: { redirect: next } as any, replace: true });
    }
  }, [sessionLoading, user, invitationId, navigate]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await client.organizations.invitations.accept(invitationId);
      await reloadOrganizations().catch(() => {});
      toast({ title: t('acceptInvitation.accepted') });
      navigate({ to: '/organizations' });
    } catch (err) {
      toast({
        title: t('acceptInvitation.acceptFailed'),
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
      await client.organizations.invitations.reject(invitationId);
      toast({ title: t('acceptInvitation.declined') });
      navigate({ to: '/organizations' });
    } catch (err) {
      toast({
        title: t('acceptInvitation.declineFailed'),
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
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('acceptInvitation.title')}</CardTitle>
            <CardDescription>
              {t('acceptInvitation.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={accepting || rejecting}
            >
              {accepting ? t('acceptInvitation.accepting') : t('acceptInvitation.accept')}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReject}
              disabled={accepting || rejecting}
            >
              {rejecting ? t('acceptInvitation.declining') : t('acceptInvitation.decline')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
