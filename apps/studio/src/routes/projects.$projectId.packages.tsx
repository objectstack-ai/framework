// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * /projects/$projectId/packages — per-project package management.
 *
 * Lists packages installed in this project and provides install/
 * enable/disable/uninstall actions. Only packages with scope=project
 * from the global registry can be installed here.
 */

import { createFileRoute, useParams, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { useClient } from '@objectstack/client-react';
import { Package, Power, PowerOff, Trash2, Plus, RefreshCw, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useProjectPackages } from '@/hooks/useProjectPackages';
import type { InstalledPackage } from '@objectstack/spec/kernel';

function ProjectPackagesComponent() {
  const { projectId } = useParams({ from: '/projects/$projectId' });
  const client = useClient() as any;
  const navigate = useNavigate();

  const { packages: installedPkgs, loading, error, install, uninstall, enable, disable, reload } =
    useProjectPackages(projectId);

  // Global registry — packages available to install
  const [availablePkgs, setAvailablePkgs] = useState<InstalledPackage[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const loadAvailable = useCallback(async () => {
    if (!client) return;
    setLoadingAvailable(true);
    try {
      const result = await client.packages.list();
      const all: InstalledPackage[] = result?.packages ?? [];
      // Filter to env-scope packages only (default); exclude dev-workspace aggregator
      setAvailablePkgs(
        all.filter(
          (p) =>
            (p.manifest as any)?.scope !== 'platform' &&
            p.manifest?.version !== '0.0.0' &&
            p.manifest?.id !== 'dev-workspace',
        ),
      );
    } catch (e) {
      console.error('[EnvPackages] Failed to load available packages:', e);
    } finally {
      setLoadingAvailable(false);
    }
  }, [client]);

  useEffect(() => { loadAvailable(); }, [loadAvailable]);

  const installedIds = new Set(installedPkgs.map((p) => p.packageId));

  // Lookup map: packageId → manifest metadata from global registry.
  // Index by both full id (com.example.crm) and the last segment (crm) for fuzzy matching.
  const registryMap = new Map<string, any>();
  for (const p of availablePkgs) {
    const id = p.manifest?.id ?? '';
    if (id) {
      registryMap.set(id, p.manifest);
      const shortId = id.split('.').pop();
      if (shortId && !registryMap.has(shortId)) registryMap.set(shortId, p.manifest);
    }
  }

  const handleInstall = async (pkgId: string, version?: string) => {
    try {
      await install({ packageId: pkgId, version });
      toast({ title: 'Package installed' });
    } catch (e) {
      toast({ title: 'Install failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleUninstall = async (pkgId: string) => {
    try {
      await uninstall(pkgId);
      toast({ title: 'Package uninstalled' });
    } catch (e) {
      toast({ title: 'Uninstall failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const handleToggle = async (pkgId: string, currentlyEnabled: boolean) => {
    try {
      if (currentlyEnabled) await disable(pkgId);
      else await enable(pkgId);
      toast({ title: currentlyEnabled ? 'Package disabled' : 'Package enabled' });
    } catch (e) {
      toast({ title: 'Operation failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-8">

            {/* Installed packages */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Installed in this project</h2>
                <Button variant="outline" size="sm" onClick={reload} disabled={loading} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {error && (
                <p className="mb-4 text-sm text-destructive">
                  Failed to load installations: {error.message}
                </p>
              )}

              {!loading && installedPkgs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No packages installed yet. Install one from the marketplace below.
                </p>
              )}

              <div className="space-y-3">
                {installedPkgs.map((pkg) => {
                  const meta = registryMap.get(pkg.packageId);
                  const displayName = meta?.name ?? pkg.packageId;
                  return (
                  <Card key={pkg.id}>
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">{displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{pkg.packageId} · v{pkg.version}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={pkg.enabled ? 'default' : 'secondary'}>
                          {pkg.status}
                        </Badge>
                        {pkg.enabled && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            title="Open package workspace"
                            onClick={() =>
                              navigate({
                                to: '/projects/$projectId/$package',
                                params: { projectId, package: pkg.packageId },
                              })
                            }
                          >
                            Open
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={pkg.enabled ? 'Disable' : 'Enable'}
                          onClick={() => handleToggle(pkg.packageId, pkg.enabled)}
                        >
                          {pkg.enabled
                            ? <PowerOff className="h-3.5 w-3.5" />
                            : <Power className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Uninstall"
                          onClick={() => handleUninstall(pkg.packageId)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </section>

            <Separator />

            {/* Marketplace / Available packages */}
            <section>
              <h2 className="mb-4 text-lg font-semibold">Available packages</h2>

              {loadingAvailable && (
                <p className="text-sm text-muted-foreground">Loading available packages…</p>
              )}

              <div className="space-y-3">
                {availablePkgs.map((pkg) => {
                  const isInstalled = installedIds.has(pkg.manifest?.id ?? '');
                  return (
                    <Card key={pkg.manifest?.id}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Package className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm">
                              {pkg.manifest?.name ?? pkg.manifest?.id}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {pkg.manifest?.id} · v{pkg.manifest?.version}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isInstalled ? (
                            <Badge variant="outline">Installed</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleInstall(pkg.manifest?.id ?? '', pkg.manifest?.version)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Install
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
    </main>
  );
}

export const Route = createFileRoute('/projects/$projectId/packages')({
  component: ProjectPackagesComponent,
});
