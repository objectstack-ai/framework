// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useCallback, useEffect, useState } from 'react';
import { useScopedClient } from '@/hooks/useObjectStackClient';

export interface ProjectApp {
  name: string;
  label?: string | { key?: string; defaultValue?: string };
  description?: string | { key?: string; defaultValue?: string };
  icon?: string;
  active?: boolean;
  isDefault?: boolean;
  navigation?: unknown[];
  areas?: Array<{ navigation?: unknown[] }>;
  packageId?: string;
  package_id?: string;
  package?: string;
}

function unwrapItems(result: unknown): ProjectApp[] {
  if (Array.isArray(result)) return result as ProjectApp[];
  if (result && typeof result === 'object') {
    const value = result as { items?: unknown; value?: unknown };
    if (Array.isArray(value.items)) return value.items as ProjectApp[];
    if (Array.isArray(value.value)) return value.value as ProjectApp[];
  }
  return [];
}

function sortApps(apps: ProjectApp[]): ProjectApp[] {
  return [...apps].sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1;
    const leftLabel = typeof left.label === 'string' ? left.label : left.name;
    const rightLabel = typeof right.label === 'string' ? right.label : right.name;
    return leftLabel.localeCompare(rightLabel);
  });
}

export function resolveProjectAppLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'defaultValue' in value) {
    return String((value as { defaultValue?: unknown }).defaultValue ?? '');
  }
  if (value && typeof value === 'object' && 'key' in value) {
    return String((value as { key?: unknown }).key ?? '');
  }
  return '';
}

export function getProjectAppNavCount(app: ProjectApp): number {
  if (Array.isArray(app.areas) && app.areas.length > 0) {
    return app.areas.reduce((total, area) => total + (area.navigation?.length ?? 0), 0);
  }
  return app.navigation?.length ?? 0;
}

export function getProjectAppPackageId(app: ProjectApp): string {
  return app.packageId ?? app.package_id ?? app.package ?? 'default';
}

export function useProjectApps(projectId: string | undefined) {
  const client = useScopedClient(projectId) as any;
  const [apps, setApps] = useState<ProjectApp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!projectId || !client?.meta) {
      setApps([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let items = unwrapItems(await client.meta.getItems('app'));
      if (items.length === 0) {
        items = unwrapItems(await client.meta.getItems('apps'));
      }
      setApps(sortApps(items));
    } catch (err) {
      setError(err as Error);
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [client, projectId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  return { apps, loading, error, reload: load };
}