// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Building2, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteHeader } from '@/components/site-header';
import { toast } from '@/hooks/use-toast';
import { useOrganizations, useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/orgs/')({
  component: OrgsListPage,
});

function OrgsListPage() {
  const { organizations, loading, reload } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const navigate = useNavigate();
  const activeId = session?.activeOrganizationId ?? undefined;

  const handleSetActive = async (id: string) => {
    try {
      await setActiveOrganization(id);
      await reload();
      toast({ title: 'Organization switched' });
    } catch (err) {
      toast({
        title: 'Failed to switch',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader selectedView="overview" />
      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Organizations</h1>
              <p className="text-sm text-muted-foreground">
                Manage the organizations you belong to.
              </p>
            </div>
            <Button onClick={() => navigate({ to: '/orgs/new' })}>
              <Plus className="mr-2 h-4 w-4" /> New organization
            </Button>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && organizations.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Building2 className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  You don't belong to any organization yet.
                </p>
                <Button onClick={() => navigate({ to: '/orgs/new' })}>
                  Create your first organization
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3">
            {organizations.map((org) => (
              <Card key={org.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base">{org.name}</CardTitle>
                    {org.slug && (
                      <CardDescription className="font-mono text-xs">{org.slug}</CardDescription>
                    )}
                  </div>
                  {org.id === activeId ? (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Check className="h-3.5 w-3.5" /> Active
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleSetActive(org.id)}>
                      Set active
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    to="/orgs/$orgId"
                    params={{ orgId: org.id }}
                    className="text-xs text-primary hover:underline"
                  >
                    View details →
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
