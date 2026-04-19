// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /environments/$environmentId — environment overview (index).
 *
 * Default landing surface when the user selects an environment. Shows a
 * snapshot of the environment record: identity, database addressing,
 * membership list, and the current active credential (metadata only, never
 * the ciphertext).
 */

import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Database,
  Users,
  KeyRound,
  MapPin,
  RefreshCw,
  Trash,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { EnvironmentBadge } from '@/components/environment-badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEnvironmentDetail } from '@/hooks/useEnvironments';
import { usePackages } from '@/hooks/usePackages';
import { useClient } from '@objectstack/client-react';
import { useProductionGuard } from '@/components/production-guard';
import { toast } from '@/hooks/use-toast';

function EnvironmentOverviewComponent() {
  const { environmentId } = useParams({
    from: '/environments/$environmentId',
  });
  const { detail, loading } = useEnvironmentDetail(environmentId);
  const { packages, selectedPackage, setSelectedPackage } = usePackages();
  const client = useClient() as any;
  const navigate = useNavigate();
  const guard = useProductionGuard();
  const [rotating, setRotating] = useState(false);

  const env = detail?.environment;

  const handleRotate = async () => {
    if (!env) return;
    const ok = await guard.confirm({
      title: 'Rotate production credential?',
      description:
        'A new credential will be issued and propagated to all runtimes. In-flight requests using the old credential may briefly fail until rollout completes.',
      confirmLabel: 'Rotate credential',
      confirmVariant: 'destructive',
      requireTypedConfirmation: true,
      typedConfirmationValue: env.displayName,
    });
    if (!ok) return;
    setRotating(true);
    try {
      const newToken =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tok_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      await client?.environments?.rotateCredential?.(env.id, newToken);
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

  return (
    <>
      <AppSidebar
        packages={packages}
        selectedPackage={selectedPackage}
        onSelectPackage={setSelectedPackage}
      />
      <main className="flex min-w-0 flex-1 flex-col h-svh overflow-hidden bg-background">
        <SiteHeader selectedView="environments" />

        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {loading && !env && (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}

            {env && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-semibold">
                        {env.displayName}
                      </h1>
                      <EnvironmentBadge envType={env.envType} />
                      {env.isDefault && (
                        <Badge variant="outline">default</Badge>
                      )}
                      <Badge variant="secondary">{env.status}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {env.id}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => navigate({
                        to: '/environments/$environmentId/packages',
                        params: { environmentId: env.id },
                      })}
                    >
                      <Package className="h-4 w-4" />
                      Packages
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate({ to: '/environments' })}
                    >
                      Back to list
                    </Button>
                  </div>
                </div>

                {env.envType === 'production' && (
                  <Card className="flex items-start gap-3 border-red-500/40 bg-red-500/5 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="text-sm">
                      <p className="font-medium text-red-700 dark:text-red-300">
                        Live production environment
                      </p>
                      <p className="text-muted-foreground">
                        Writes in this environment affect real customer data.
                        Studio will prompt for confirmation before destructive
                        actions.
                      </p>
                    </div>
                  </Card>
                )}

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Database className="h-3.5 w-3.5" />
                    Database
                  </h2>
                  {detail?.database ? (
                    <dl className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <dt className="text-muted-foreground">Driver</dt>
                      <dd>
                        <code className="font-mono">
                          {detail.database.driver}
                        </code>
                      </dd>
                      <dt className="text-muted-foreground">Region</dt>
                      <dd className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {detail.database.region}
                      </dd>
                      <dt className="text-muted-foreground">Physical name</dt>
                      <dd>
                        <code className="font-mono text-xs">
                          {detail.database.databaseName}
                        </code>
                      </dd>
                      <dt className="text-muted-foreground">Storage quota</dt>
                      <dd>{detail.database.storageLimitMb} MB</dd>
                      <dt className="text-muted-foreground">Provisioned</dt>
                      <dd>
                        {new Date(
                          detail.database.provisionedAt,
                        ).toLocaleString()}
                      </dd>
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Database is still provisioning…
                    </p>
                  )}
                </Card>

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
                      disabled={rotating}
                      className="gap-2"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`}
                      />
                      Rotate
                    </Button>
                  </div>
                  {detail?.credential ? (
                    <dl className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <Badge variant="secondary">
                          {detail.credential.status}
                        </Badge>
                      </dd>
                      <dt className="text-muted-foreground">Credential ID</dt>
                      <dd>
                        <code className="font-mono text-xs">
                          {detail.credential.id}
                        </code>
                      </dd>
                      {detail.credential.activatedAt && (
                        <>
                          <dt className="text-muted-foreground">Activated</dt>
                          <dd>
                            {new Date(
                              detail.credential.activatedAt,
                            ).toLocaleString()}
                          </dd>
                        </>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No credential metadata available.
                    </p>
                  )}
                </Card>

                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    Your access
                  </h2>
                  {detail?.membership ? (
                    <div className="text-sm">
                      <p>
                        Role:{' '}
                        <Badge variant="outline" className="ml-1">
                          {detail.membership.role}
                        </Badge>
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Membership info unavailable.
                    </p>
                  )}
                </Card>

                <Separator />

                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" className="gap-2" disabled>
                    <Trash className="h-3.5 w-3.5" />
                    Archive environment
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export const Route = createFileRoute('/environments/$environmentId/')({
  component: EnvironmentOverviewComponent,
});
