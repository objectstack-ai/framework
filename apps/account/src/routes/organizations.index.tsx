// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Building2, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useOrganizations, useSession } from '@/hooks/useSession';

export const Route = createFileRoute('/organizations/')({
  component: OrgsListPage,
});

function OrgsListPage() {
  const { organizations, loading } = useOrganizations();
  const { session, setActiveOrganization } = useSession();
  const navigate = useNavigate();
  const activeId = session?.activeOrganizationId ?? undefined;

  const handleSelect = async (id: string) => {
    try {
      if (id !== activeId) {
        await setActiveOrganization(id);
      }
      navigate({ to: '/organizations/$orgId', params: { orgId: id } });
    } catch (err) {
      toast({
        title: 'Failed to switch organization',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 px-6 py-8 overflow-auto">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Organizations</h1>
              <p className="text-sm text-muted-foreground">
                Select an organization to work with, or create a new one.
              </p>
            </div>
            <Button onClick={() => navigate({ to: '/organizations/new' })}>
              <Plus className="mr-2 h-4 w-4" /> New organization
            </Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!loading && organizations.length === 0 && (
            <Card className="p-10 text-center">
              <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="text-base font-medium">No organizations yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first organization to start building.
              </p>
              <Button onClick={() => navigate({ to: '/organizations/new' })}>
                <Plus className="mr-2 h-4 w-4" />
                Create organization
              </Button>
            </Card>
          )}

          <div className="grid gap-3">
            {organizations.map((org) => {
              const isActive = org.id === activeId;
              return (
                <Card
                  key={org.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(org.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(org.id);
                    }
                  }}
                  className={`cursor-pointer p-4 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring ${
                    isActive ? 'border-primary ring-1 ring-primary/40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-medium">
                          {org.name}
                        </h3>
                        {isActive && (
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Check className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                      </div>
                      {org.slug && (
                        <code className="mt-1 block font-mono text-xs text-muted-foreground">
                          {org.slug}
                        </code>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
