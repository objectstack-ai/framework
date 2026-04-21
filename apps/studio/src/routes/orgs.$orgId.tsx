// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useClient } from '@objectstack/client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useOrganizations, useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/orgs/$orgId')({
  component: OrgDetailPage,
});

function OrgDetailPage() {
  const { orgId } = Route.useParams();
  const navigate = useNavigate();
  const client = useClient() as any;
  const { organizations } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const org = organizations.find((o) => o.id === orgId);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      if (!client?.organizations) return;
      setLoadingMembers(true);
      try {
        const res = await client.organizations.listMembers(orgId);
        if (cancelled) return;
        setMembers(res?.members ?? res?.data?.members ?? res ?? []);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    }
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [client, orgId]);

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

  const isActive = session?.activeOrganizationId === orgId;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 px-6 py-8 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/orgs' })}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {!isActive && (
              <Button size="sm" onClick={handleSetActive}>
                Set as active
              </Button>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{org?.name ?? 'Organization'}</CardTitle>
              {org?.slug && (
                <CardDescription className="font-mono text-xs">{org.slug}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID</span>
                <code className="text-xs">{orgId}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span>{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>People with access to this organization.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMembers && <p className="text-xs text-muted-foreground">Loading…</p>}
              {!loadingMembers && members.length === 0 && (
                <p className="text-xs text-muted-foreground">No members found.</p>
              )}
              <ul className="divide-y">
                {members.map((m, i) => (
                  <li key={m.id ?? i} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">{m.user?.name || m.name || m.userId}</div>
                      {m.user?.email && (
                        <div className="text-[11px] text-muted-foreground">{m.user.email}</div>
                      )}
                    </div>
                    <code className="text-[10px] text-muted-foreground">{m.role ?? 'member'}</code>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Need to manage environments?{' '}
            <Link to="/environments" className="text-primary hover:underline">
              Go to environments
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
