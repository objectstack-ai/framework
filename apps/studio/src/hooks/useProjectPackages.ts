// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect, useCallback } from 'react';
import { useClient } from '@objectstack/client-react';

export interface EnvPackage {
  id: string;
  projectId: string;
  packageId: string;
  version: string;
  status: string;
  enabled: boolean;
  installedAt: string;
  installedBy?: string;
  settings?: Record<string, unknown>;
  upgradeHistory?: Array<{ fromVersion: string; toVersion: string; upgradedAt: string; status: string }>;
}

export function useProjectPackages(projectId: string | undefined) {
  const client = useClient() as any;
  const [packages, setPackages] = useState<EnvPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!client || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.projects.packages.list(projectId);
      // Normalize snake_case DB fields to camelCase interface
      const rows = (result?.packages ?? []).map((r: any) => ({
        id: r.id,
        projectId: r.environment_id ?? r.projectId,
        packageId: r.package_id ?? r.packageId,
        version: r.version,
        status: r.status,
        enabled: r.enabled,
        installedAt: r.installed_at ?? r.installedAt,
        installedBy: r.installed_by ?? r.installedBy,
        settings: r.settings,
        upgradeHistory: r.upgrade_history ?? r.upgradeHistory,
      }));
      setPackages(rows);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [client, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const install = useCallback(async (body: {
    packageId: string;
    version?: string;
    settings?: Record<string, unknown>;
    enableOnInstall?: boolean;
  }) => {
    if (!client || !projectId) return;
    const result = await client.projects.packages.install(projectId, body);
    await load();
    return result?.package;
  }, [client, projectId, load]);

  const uninstall = useCallback(async (pkgId: string) => {
    if (!client || !projectId) return;
    await client.projects.packages.uninstall(projectId, pkgId);
    await load();
  }, [client, projectId, load]);

  const enable = useCallback(async (pkgId: string) => {
    if (!client || !projectId) return;
    await client.projects.packages.enable(projectId, pkgId);
    await load();
  }, [client, projectId, load]);

  const disable = useCallback(async (pkgId: string) => {
    if (!client || !projectId) return;
    await client.projects.packages.disable(projectId, pkgId);
    await load();
  }, [client, projectId, load]);

  return { packages, loading, error, install, uninstall, enable, disable, reload: load };
}
