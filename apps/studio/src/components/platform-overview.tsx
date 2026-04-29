// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PlatformOverview
 *
 * Landing surface for the platform pseudo-project. Shows a summary of
 * system-level metadata registered in the control plane: object count,
 * registered metadata types, and a quick-link grid to each protocol group.
 *
 * Mounted from `projects.$projectId.index.tsx` whenever the route param
 * `projectId` matches `PLATFORM_PROJECT_ID`.
 */

import { useEffect, useState } from 'react';
import {
  Database,
  AppWindow,
  Workflow,
  Shield,
  Bot,
  Globe,
  Layers,
  Package,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useClient } from '@objectstack/client-react';

interface MetaSummary {
  type: string;
  count: number;
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  object: Database,
  app: AppWindow,
  flow: Workflow,
  permission: Shield,
  agent: Bot,
  api: Globe,
  plugin: Layers,
};

export function PlatformOverview() {
  const client = useClient() as any;
  const [summary, setSummary] = useState<MetaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const typesResult = await client?.meta?.getTypes?.();
        const types: string[] = typesResult?.types ?? typesResult ?? [];

        const entries = await Promise.all(
          types.slice(0, 20).map(async (type: string) => {
            try {
              const result = await client?.meta?.getItems?.(type);
              const items: unknown[] = Array.isArray(result)
                ? result
                : result?.items ?? result?.value ?? [];
              return { type, count: items.length };
            } catch {
              return { type, count: 0 };
            }
          }),
        );
        setSummary(entries.filter((e) => e.count > 0));
      } catch {
        setSummary([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [client]);

  const totalObjects = summary.find((s) => s.type === 'object')?.count ?? 0;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Platform</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              System-level metadata registered in the control plane. These
              definitions are read-only and shared across all projects.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Objects</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {loading ? '—' : totalObjects}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Metadata types</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {loading ? '—' : summary.length}
              </p>
            </Card>
            <Card className="p-4 col-span-2">
              <p className="text-xs text-muted-foreground">Scope</p>
              <p className="mt-1 text-sm font-mono">Control plane · system</p>
            </Card>
          </div>

          {!loading && summary.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Registered types
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {summary.map(({ type, count }) => {
                  const Icon = GROUP_ICONS[type] ?? Package;
                  return (
                    <Card
                      key={type}
                      className="flex items-center gap-3 p-3"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium capitalize">
                          {type}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {count}
                        </p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
              Loading platform metadata…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
