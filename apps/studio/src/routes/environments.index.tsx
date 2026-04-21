// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /environments — environment list & management page.
 *
 * Entry point for the environment administration flows: lists every
 * environment visible to the current session, groups them by envType,
 * and surfaces one-click navigation into each environment's overview
 * (`/environments/:environmentId`).
 *
 * Provisioning new environments is handled by {@link NewEnvironmentDialog}
 * exposed via the "New environment" button.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, Database, MapPin, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnvironmentBadge } from '@/components/environment-badge';
import { EnvironmentStatusBadge } from '@/components/environment-status-badge';
import { NewEnvironmentDialog } from '@/components/new-environment-dialog';
import { useEnvironments } from '@/hooks/useEnvironments';

function EnvironmentsListComponent() {
  const navigate = useNavigate();
  const { environments, loading, reload } = useEnvironments();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Environments</h1>
              <p className="text-sm text-muted-foreground">
                Each environment has a physically isolated database. Switch
                between them from the header at any time.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New environment
            </Button>
          </div>

          <div className="mb-3 flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reload()}
              disabled={loading}
              className="gap-2"
              title="Refresh the environment list (does not auto-poll)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading && (
            <div className="text-sm text-muted-foreground">Loading…</div>
          )}

          {!loading && environments.length === 0 && (
            <Card className="p-10 text-center">
              <Database className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h3 className="text-base font-medium">No environments yet</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first environment to start building.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create environment
              </Button>
            </Card>
          )}

          <div className="grid gap-3">
            {environments.map((env) => (
              <Card
                key={env.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate({
                    to: '/environments/$environmentId',
                    params: { environmentId: env.id },
                  })
                }
                className="cursor-pointer p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-medium">
                        {env.displayName}
                      </h3>
                      <EnvironmentBadge envType={env.envType} />
                      {env.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          default
                        </Badge>
                      )}
                      <EnvironmentStatusBadge status={env.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <code className="font-mono">{env.slug}</code>
                      {env.region && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {env.region}
                        </span>
                      )}
                      <code className="font-mono opacity-60">{env.id}</code>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <NewEnvironmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (env) => {
          await reload();
          navigate({
            to: '/environments/$environmentId',
            params: { environmentId: env.id },
          });
        }}
      />
    </main>
  );
}

export const Route = createFileRoute('/environments/')({
  component: EnvironmentsListComponent,
});
