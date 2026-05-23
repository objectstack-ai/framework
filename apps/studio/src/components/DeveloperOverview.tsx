// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DeveloperOverview — Studio home page, redesigned as a "workspace
 * launchpad" (think Airtable / Power Apps / Notion home).
 *
 * Old design (the dev-ops dashboard) prioritised four big stat cards
 * (Packages 13, Objects 13, Metadata Types 34, REST API Live). Useful
 * once, useless after — and worse, it conveyed "this is a monitoring
 * tool" not "this is where you build". A walkthrough as a low-code dev
 * surfaced this as the #1 vibe gap.
 *
 * New layout, top-down:
 *
 *   1. Hero greeting (time-aware)            — sets the tone, names
 *                                               the package.
 *   2. Quick-start card row (4 tiles)        — primary "I want to
 *      Object · View · Form · Flow            build X" intents. Each
 *                                               navigates to that list
 *                                               page (where Create
 *                                               affordances live).
 *   3. Recent items                          — last 12 visited, MRU.
 *      Two columns of 6 rows.                  One-click drill-in.
 *   4. Browse by metadata type               — the registry, kept but
 *                                               compacted. Counts are
 *                                               clickable.
 *   5. Footer stats strip                    — packages / objects /
 *                                               metadata items inline,
 *                                               not hero cards.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { useScopedClient } from '@/hooks/useObjectStackClient';
import { useRecentItems } from '@/hooks/useRecentItems';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Database, Layers, Globe, ExternalLink, Code2,
  Sparkles, Workflow, FileSpreadsheet, LayoutGrid,
  Bot, Shield, ScrollText, History, ArrowRight, RefreshCw,
} from 'lucide-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';
import { WelcomeOnboarding } from '@/components/WelcomeOnboarding';
import { iconForMetadataType, typeLabel, navItemForType } from '@/components/studio-nav';
import { QuickStartCard } from '@/components/QuickStartCard';
import { CreateMetadataDialog } from '@/components/CreateMetadataDialog';

function dedupeRegistryEntries(
  types: string[],
  counts: Record<string, number>,
): Array<[string, number]> {
  const byKey = new Map<string, { name: string; count: number }>();
  const norm = (t: string) => t.replace(/_/g, '').toLowerCase();
  const isCamel = (t: string) => !t.includes('_');
  for (const t of types) {
    const key = norm(t);
    const count = counts[t] ?? 0;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { name: t, count });
      continue;
    }
    const preferred = isCamel(t) && !isCamel(existing.name) ? t : existing.name;
    byKey.set(key, { name: preferred, count: existing.count + count });
  }
  return Array.from(byKey.values()).map(({ name, count }) => [name, count] as [string, number]);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface DeveloperOverviewProps {
  packages: InstalledPackage[];
  selectedPackage?: InstalledPackage | null;
  onNavigate?: (view: string, detail?: string) => void;
}

interface SystemStats {
  packages: { total: number; enabled: number };
  metadata: { types: string[]; counts: Record<string, number> };
  loading: boolean;
}

export function DeveloperOverview({ packages, selectedPackage, onNavigate = () => {} }: DeveloperOverviewProps) {
  const params = useParams({ strict: false }) as { projectId?: string };
  const client = useScopedClient(params.projectId);
  const packageId = selectedPackage?.manifest?.id;
  const { items: recent, clear: clearRecent } = useRecentItems(packageId);

  // When a Quick Start tile is clicked we open the CreateMetadataDialog
  // pre-scoped to that one metadata type. This closes the loop the
  // launchpad promises (Home → "what would you like to build?") and
  // saves the user from a list-page detour just to find '+ New'.
  const [createType, setCreateType] = useState<string | null>(null);

  const [stats, setStats] = useState<SystemStats>({
    packages: { total: 0, enabled: 0 },
    metadata: { types: [], counts: {} },
    loading: true,
  });

  const loadStats = useCallback(async () => {
    if (!client) return;
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const typesResult = await client.meta.getTypes();
      const types: string[] = typesResult?.types || (Array.isArray(typesResult) ? typesResult : []);
      const countEntries = await Promise.all(
        types.map(async (type) => {
          try {
            const result = await client.meta.getItems(type, packageId ? { packageId } : undefined);
            const items = result?.items || (Array.isArray(result) ? result : []);
            return [type, items.length] as const;
          } catch {
            return [type, 0] as const;
          }
        })
      );
      const counts = Object.fromEntries(countEntries);
      const enabled = packages.filter(p => p.enabled).length;
      setStats({
        packages: { total: packages.length, enabled },
        metadata: { types, counts },
        loading: false,
      });
    } catch (err) {
      console.error('[DeveloperOverview] Failed to load stats:', err);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }, [client, packages, packageId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const totalMetaItems = useMemo(
    () => Object.values(stats.metadata.counts).reduce((a, b) => a + b, 0),
    [stats.metadata.counts],
  );
  const objectCount = stats.metadata.counts['object'] || 0;

  // First-run onboarding: no metadata authored yet for this package.
  if (!stats.loading && totalMetaItems === 0 && selectedPackage?.manifest?.id) {
    return <WelcomeOnboarding packageId={selectedPackage.manifest.id} />;
  }

  const registryEntries = dedupeRegistryEntries(stats.metadata.types, stats.metadata.counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6 lg:p-8">

        {/* ── 1. Hero greeting ─────────────────────────────────── */}
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {greeting()} · {selectedPackage?.manifest?.id || 'ObjectStack Studio'}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              {selectedPackage?.manifest?.name || 'Welcome back'}
            </h1>
            <p className="text-sm text-muted-foreground">
              What would you like to build today?
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadStats}
            disabled={stats.loading}
            className="gap-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3 w-3 ${stats.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </header>

        {/* ── 2. Quick Start tiles ─────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick start
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickStartCard
              icon={Database}
              tone="sky"
              title="Object"
              description="Define a new data model with fields, validations, and relationships."
              onClick={() => setCreateType('object')}
            />
            <QuickStartCard
              icon={LayoutGrid}
              tone="violet"
              title="View"
              description="Lay out a grid, kanban, calendar, or gantt for any object."
              onClick={() => setCreateType('view')}
            />
            <QuickStartCard
              icon={FileSpreadsheet}
              tone="emerald"
              title="Form"
              description="Build a form to collect data — internal record entry or public intake."
              onClick={() => setCreateType('view')}
            />
            <QuickStartCard
              icon={Workflow}
              tone="amber"
              title="Flow"
              description="Wire trigger-based automation across objects, services, and AI."
              onClick={() => setCreateType('flow')}
            />
          </div>
        </section>

        {/* ── 3. Recent + 4. Registry side by side on lg, stacked below ── */}
        <div className="grid gap-6 lg:grid-cols-5">

          {/* Recent items (wide left column) */}
          <section className="lg:col-span-3">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent
              </h2>
              {recent.length > 0 && (
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
            <Card className="border-border/60">
              <CardContent className="p-1.5">
                {recent.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 px-3 py-8 text-center">
                    <History className="h-5 w-5 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No recent items yet</p>
                    <p className="text-xs text-muted-foreground/70">Items you open will appear here.</p>
                  </div>
                ) : (
                  <ul className="grid gap-0.5 sm:grid-cols-2">
                    {recent.map((it) => {
                      const Icon = iconForMetadataType(it.type) ?? Code2;
                      const dest = it.type === 'object'
                        ? `object:${it.name}`
                        : `metadata:${it.type}:${it.name}`;
                      return (
                        <li key={dest}>
                          <button
                            type="button"
                            onClick={() => {
                              if (it.type === 'object') onNavigate('object', it.name);
                              else onNavigate(`metadata:${it.type}`, it.name);
                            }}
                            className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60"
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">
                                {it.label || it.name}
                              </div>
                              <div className="truncate text-[10px] text-muted-foreground">
                                {typeLabel(it.type)} · {relativeTime(it.ts)}
                              </div>
                            </div>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/0 transition group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Browse by type (narrow right column) */}
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Browse by type
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {totalMetaItems} items
              </span>
            </div>
            <Card className="border-border/60">
              <CardContent className="p-1.5">
                {stats.loading && registryEntries.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
                ) : (
                  <ul className="grid gap-0.5">
                    {registryEntries.slice(0, 12).map(([type, count]) => {
                      const Icon = iconForMetadataType(type) ?? Code2;
                      const label = typeLabel(type);
                      const nav = navItemForType(type);
                      const clickable = !!nav;
                      return (
                        <li key={type}>
                          <button
                            type="button"
                            disabled={!clickable}
                            onClick={clickable ? () => onNavigate(nav!.key) : undefined}
                            className={
                              'group flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ' +
                              (clickable ? 'hover:bg-muted/60' : 'opacity-60 cursor-default')
                            }
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate text-sm">{label}</span>
                            </div>
                            <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                              {count}
                            </Badge>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* ── 5. Footer stat strip ─────────────────────────────── */}
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            <span className="tabular-nums">{stats.packages.total}</span> packages
            <span className="text-muted-foreground/60">({stats.packages.enabled} enabled)</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            <span className="tabular-nums">{objectCount}</span> objects
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span className="tabular-nums">{stats.metadata.types.length}</span> metadata types
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-emerald-500" />
            REST API <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">/api/v1</code> live
          </span>
        </footer>
      </div>

      <CreateMetadataDialog
        open={createType !== null}
        onOpenChange={(o) => { if (!o) setCreateType(null); }}
        types={createType ? [createType] : []}
        packageId={packageId}
      />
    </div>
  );
}
