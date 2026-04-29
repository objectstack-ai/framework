// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { useClient } from '@objectstack/client-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

export interface UsePackagesOptions {
  /**
   * When `'project'` (default), exclude platform-scoped packages (they are
   * runtime-global, not env-installable). When `'platform'`, return ONLY
   * platform-scoped packages — used by the platform pseudo-project surface.
   */
  scope?: 'project' | 'platform';
}

/**
 * Hook to fetch and manage installed packages
 */
export function usePackages(options: UsePackagesOptions = {}) {
  const { scope = 'project' } = options;
  const client = useClient();
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<InstalledPackage | null>(null);

  useEffect(() => {
    if (!client) return;
    let mounted = true;

    async function loadPackages() {
      try {
        const result = await client.packages.list();
        const all: InstalledPackage[] = result?.packages || [];
        // Always exclude dev-workspace (monorepo aggregator) and unversioned packages.
        // Then narrow by scope.
        const items = all.filter((p) => {
          if (p.manifest?.version === '0.0.0') return false;
          if (p.manifest?.id === 'dev-workspace') return false;
          const pkgScope = (p.manifest as any)?.scope;
          if (scope === 'platform') return pkgScope === 'platform';
          return pkgScope !== 'platform';
        });
        console.log('[App] Fetched packages:', items.map((p) => p.manifest?.name || p.manifest?.id));
        if (mounted) {
          setPackages(items);
          setSelectedPackage((prev) =>
            items.length === 0
              ? null
              : prev && items.some((p) => p.manifest?.id === prev.manifest?.id)
                ? prev
                : items[0],
          );
        }
      } catch (err) {
        console.error('[App] Failed to fetch packages:', err);
      }
    }

    loadPackages();
    return () => { mounted = false; };
  }, [client, scope]);

  return { packages, selectedPackage, setSelectedPackage };
}
