// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect } from 'react';
import { useClient } from '@objectstack/client-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

/**
 * Hook to fetch and manage installed packages
 */
export function usePackages() {
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
        // Filter out the root dev-workspace — it's the monorepo aggregator, not a real package
        const items = all.filter((p) => p.manifest?.version !== '0.0.0' && p.manifest?.id !== 'dev-workspace');
        console.log('[App] Fetched packages:', items.map((p) => p.manifest?.name || p.manifest?.id));
        if (mounted && items.length > 0) {
          setPackages(items);
          setSelectedPackage(items[0]);
        }
      } catch (err) {
        console.error('[App] Failed to fetch packages:', err);
      }
    }

    loadPackages();
    return () => { mounted = false; };
  }, [client]);

  return { packages, selectedPackage, setSelectedPackage };
}
