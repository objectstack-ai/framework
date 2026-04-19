// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect, useCallback } from 'react';
import { useClient } from '@objectstack/client-react';

export interface EnvPackage {
  id: string;
  environmentId: string;
  packageId: string;
  version: string;
  status: string;
  enabled: boolean;
  installedAt: string;
  installedBy?: string;
  settings?: Record<string, unknown>;
  upgradeHistory?: Array<{ fromVersion: string; toVersion: string; upgradedAt: string; status: string }>;
}

export function useEnvironmentPackages(environmentId: string | undefined) {
  const client = useClient() as any;
  const [packages, setPackages] = useState<EnvPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!client || !environmentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.environments.packages.list(environmentId);
      // Normalize snake_case DB fields to camelCase interface
      const rows = (result?.packages ?? []).map((r: any) => ({
        id: r.id,
        environmentId: r.environment_id ?? r.environmentId,
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
  }, [client, environmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const install = useCallback(async (body: {
    packageId: string;
    version?: string;
    settings?: Record<string, unknown>;
    enableOnInstall?: boolean;
  }) => {
    if (!client || !environmentId) return;
    const result = await client.environments.packages.install(environmentId, body);
    await load();
    return result?.package;
  }, [client, environmentId, load]);

  const uninstall = useCallback(async (pkgId: string) => {
    if (!client || !environmentId) return;
    await client.environments.packages.uninstall(environmentId, pkgId);
    await load();
  }, [client, environmentId, load]);

  const enable = useCallback(async (pkgId: string) => {
    if (!client || !environmentId) return;
    await client.environments.packages.enable(environmentId, pkgId);
    await load();
  }, [client, environmentId, load]);

  const disable = useCallback(async (pkgId: string) => {
    if (!client || !environmentId) return;
    await client.environments.packages.disable(environmentId, pkgId);
    await load();
  }, [client, environmentId, load]);

  return { packages, loading, error, install, uninstall, enable, disable, reload: load };
}
