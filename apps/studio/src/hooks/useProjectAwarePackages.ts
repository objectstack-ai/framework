// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useMemo } from 'react';
import type { InstalledPackage } from '@objectstack/spec/kernel';
import { usePackages } from './usePackages';
import { useProjectPackages } from './useProjectPackages';
import { isPlatformProject } from '@/lib/platform-project';

/**
 * Returns the subset of the global package registry that is installed in the
 * given environment. Combines:
 *  - `useProjectPackages(envId)` — per-env DB records (have short packageId)
 *  - `usePackages()` — global runtime registry (have full manifest.id)
 *
 * The cross-reference is fuzzy: a record with `packageId = "crm"` matches a
 * manifest with `id = "com.example.crm"` (last dot-segment equality).
 *
 * For the platform pseudo-project, returns platform-scoped global packages
 * directly without any per-env install join.
 */
export function useEnvAwarePackages(envId: string | undefined) {
  const isPlatform = isPlatformProject(envId);
  const { packages: globalPkgs } = usePackages({
    scope: isPlatform ? 'platform' : 'project',
  });
  const { packages: installedRecords } = useProjectPackages(envId);

  const [selectedPackage, setSelectedPackage] = useState<InstalledPackage | null>(null);

  const packages = useMemo<InstalledPackage[]>(() => {
    if (isPlatform) {
      // Every platform-scoped global package is implicitly "installed".
      return globalPkgs;
    }
    if (!installedRecords.length || !globalPkgs.length) return [];

    // Build a set of all installed identifiers (full + short segment)
    const installedIds = new Set<string>();
    for (const rec of installedRecords) {
      const id = rec.packageId;
      if (!id) continue;
      installedIds.add(id);
      // If already a reverse-domain ID, add short segment too
      const seg = id.split('.').pop();
      if (seg) installedIds.add(seg);
    }

    // Keep global packages whose manifest.id is in the installed set (full or short)
    return globalPkgs.filter((p) => {
      const mid = p.manifest?.id ?? '';
      if (!mid) return false;
      if (installedIds.has(mid)) return true;
      // Match by last segment: "com.example.crm" → "crm"
      const seg = mid.split('.').pop();
      return seg ? installedIds.has(seg) : false;
    });
  }, [isPlatform, globalPkgs, installedRecords]);

  return { packages, selectedPackage, setSelectedPackage };
}
