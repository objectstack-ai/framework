// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Generic metadata list page — used by every top-level nav area
 * (Objects, Forms, Views & Apps, Automations, AI, Security, APIs).
 *
 * Behavior:
 *   • Loads items for each provided `types[]` from the metadata service.
 *   • Renders a single search box + type-filter chips + result grid.
 *   • Empty / loading / error states.
 *   • Row click routes to the correct viewer:
 *       - `object` → /pkg/objects/$name (Object Hub)
 *       - everything else → /pkg/metadata/$type/$name (PluginHost)
 *
 * This component intentionally replaces the old sidebar tree as the
 * primary "find a metadata item" UX — scaling to thousands of items
 * with search + filter rather than a deep collapsible tree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Eye, LayoutGrid, List, Plus, Search } from 'lucide-react';
import { useClient, useMetadataSubscriptionCallback } from '@objectstack/client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateMetadataDialog } from './CreateMetadataDialog';
import { MetadataPreview } from './MetadataPreview';
import { iconForMetadataType, typeLabel } from './studio-nav';
import { pickLabel, pickDescription } from '@/lib/metadata-display';
import { formatRelative } from '@/lib/format-relative';
import type { LucideIcon } from 'lucide-react';

/** Metadata types we can render a live preview for via @object-ui. */
const PREVIEWABLE_TYPES = new Set(['object', 'view', 'dashboard']);

export interface MetadataListPageProps {
  /** Display title (e.g. "Objects", "Forms"). */
  title: string;
  /** Short subtitle / job description. */
  subtitle: string;
  /** Metadata types to surface (e.g. ['view', 'app', 'dashboard']). */
  types: string[];
  /** Package id (URL parameter). Empty / 'all' / falsy → query all packages. */
  packageId: string | null | undefined;
  /** Optional client-side filter — used by Forms to keep only `viewType === 'form'`. */
  filterItem?: (item: any, type: string) => boolean;
  /** Optional extra header content (e.g. publish button). */
  rightSlot?: React.ReactNode;
  /** Optional empty-state CTA. */
  emptyCta?: React.ReactNode;
  /** Optional icon override per row. */
  iconForType?: (type: string) => LucideIcon | undefined;
}

interface Row {
  type: string;
  name: string;
  label: string;
  description?: string;
  updatedAt?: string;
  raw: any;
}

export function MetadataListPage({
  title,
  subtitle,
  types,
  packageId,
  filterItem,
  rightSlot,
  emptyCta,
  iconForType,
}: MetadataListPageProps) {
  const client = useClient();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'cards';
    return (localStorage.getItem('studio.listViewMode') as 'cards' | 'compact') || 'cards';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('studio.listViewMode', viewMode);
  }, [viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all: Row[] = [];
      // 'all' (no-filter sentinel) and falsy → query without package filter.
      const opts = packageId && packageId !== 'all' ? { packageId } : undefined;
      for (const type of types) {
        try {
          const res = await client.meta.getItems(type, opts);
          const items: any[] = res?.items || (Array.isArray(res) ? res : []);
          for (const item of items) {
            if (filterItem && !filterItem(item, type)) continue;
            all.push({
              type,
              name: item.name || item.id || 'unknown',
              label: pickLabel(item),
              description: pickDescription(item, type),
              updatedAt: item.updatedAt || item._updatedAt,
              raw: item,
            });
          }
        } catch (e) {
          // tolerate single-type failures
          console.warn(`[MetadataListPage] failed to load ${type}`, e);
        }
      }
      setRows(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client, packageId, types, filterItem]);

  useEffect(() => {
    load();
  }, [load]);

  useMetadataSubscriptionCallback('object', load);
  useMetadataSubscriptionCallback('view', load);
  useMetadataSubscriptionCallback('flow', load);
  useMetadataSubscriptionCallback('agent', load);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeTypes.size > 0 && !activeTypes.has(r.type)) return false;
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    });
  }, [rows, query, activeTypes]);

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.type] = (m[r.type] ?? 0) + 1;
    return m;
  }, [rows]);

  const toggleType = (t: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const openRow = (row: Row) => {
    const pkg = packageId || 'all';
    if (row.type === 'object') {
      navigate({ to: `/${pkg}/objects/${row.name}` });
    } else {
      navigate({ to: `/${pkg}/metadata/${row.type}/${row.name}` });
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="border-b px-6 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground lg:block">{subtitle}</p>
          </div>
          <div className="relative ml-auto w-64 max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
          {types.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {types.map((t) => {
                const count = typeCounts[t] ?? 0;
                if (count === 0) return null;
                const active = activeTypes.has(t);
                const label = typeLabel(t);
                return (
                  <Button
                    key={t}
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleType(t)}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {label} <span className="opacity-60">{count}</span>
                  </Button>
                );
              })}
            </div>
          )}
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => setViewMode('cards')}
              title="Card view"
              aria-label="Card view"
              aria-pressed={viewMode === 'cards'}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2"
              onClick={() => setViewMode('compact')}
              title="Compact list"
              aria-label="Compact list"
              aria-pressed={viewMode === 'compact'}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
          {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-destructive">Failed: {error}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            {/* Tinted icon medallion: hints at the kind of thing the user is about to create. */}
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-muted to-muted/40 ring-1 ring-border">
              {(() => {
                const Icon = iconForType?.(types[0]) ?? iconForMetadataType(types[0]);
                return Icon ? <Icon className="h-6 w-6 text-muted-foreground" /> : <Plus className="h-6 w-6 text-muted-foreground" />;
              })()}
            </div>
            <div className="space-y-1.5">
              <p className="text-base font-semibold">
                {rows.length === 0
                  ? packageId && packageId !== 'all'
                    ? `No ${title.toLowerCase()} in this package yet`
                    : `No ${title.toLowerCase()} yet`
                  : `No ${title.toLowerCase()} match "${query}"`}
              </p>
              {rows.length === 0 ? (
                <p className="max-w-md text-xs text-muted-foreground">{subtitle}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Try adjusting your search or type filter.</p>
              )}
            </div>
            {rows.length === 0 && (
              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create your first {types.length === 1 ? typeLabel(types[0]) : title.toLowerCase().replace(/s$/, '')}
              </Button>
            )}
            {emptyCta}
          </div>
        ) : viewMode === 'compact' ? (
          <CompactList
            rows={filtered}
            showTypeBadge={types.length > 1}
            iconForType={iconForType}
            onOpen={openRow}
            onPreview={setPreviewRow}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((row) => {
              const Icon = iconForType?.(row.type) ?? iconForMetadataType(row.type);
              const canPreview = PREVIEWABLE_TYPES.has(row.type);
              // Only show per-card type badge when the page mixes multiple
              // metadata types — otherwise it's noise (the page title
              // already conveys the type).
              const showTypeBadge = types.length > 1;
              return (
                <Card
                  key={`${row.type}:${row.name}`}
                  className="group cursor-pointer transition hover:border-primary hover:shadow-sm"
                  onClick={() => openRow(row)}
                >
                  <CardContent className="flex flex-col gap-1.5 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span
                          className="line-clamp-2 break-words font-medium leading-snug"
                          title={row.label}
                        >
                          {row.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {showTypeBadge && (
                          <Badge variant="secondary" className="text-[10px]">
                            {typeLabel(row.type)}
                          </Badge>
                        )}
                        {canPreview && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-40 transition group-hover:opacity-100"
                            title="Preview"
                            aria-label={`Preview ${row.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewRow(row);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {row.description ? (
                      <p
                        className="line-clamp-2 text-xs text-muted-foreground"
                        title={row.description}
                      >
                        {row.description}
                      </p>
                    ) : null}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <code className="truncate text-[11px] text-muted-foreground/70" title={row.name}>
                        {row.name}
                      </code>
                      {row.updatedAt && (
                        <span className="shrink-0 text-[10px] text-muted-foreground/70" title={row.updatedAt}>
                          {formatRelative(row.updatedAt)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!previewRow} onOpenChange={(o) => !o && setPreviewRow(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewRow?.label ?? previewRow?.name}</DialogTitle>
            <DialogDescription>
              Live preview rendered with @object-ui against the configured backend.
            </DialogDescription>
          </DialogHeader>
          {previewRow && (
            <div className="h-[70vh] overflow-hidden">
              <MetadataPreview
                type={previewRow.type}
                name={previewRow.name}
                spec={previewRow.raw?.spec ?? previewRow.raw}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateMetadataDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        types={types}
        packageId={packageId}
      />
    </div>
  );
}

interface CompactListProps {
  rows: Row[];
  showTypeBadge: boolean;
  iconForType?: (type: string) => LucideIcon | undefined;
  onOpen: (row: Row) => void;
  onPreview: (row: Row) => void;
}

function CompactList({ rows, showTypeBadge, iconForType, onOpen, onPreview }: CompactListProps) {
  return (
    <div className="divide-y rounded-md border bg-card">
      {rows.map((row) => {
        const Icon = iconForType?.(row.type) ?? iconForMetadataType(row.type);
        const canPreview = PREVIEWABLE_TYPES.has(row.type);
        return (
          <div
            key={`${row.type}:${row.name}`}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(row);
              }
            }}
            className="group grid cursor-pointer grid-cols-[auto_minmax(0,2fr)_minmax(0,3fr)_auto_auto] items-center gap-3 px-3 py-2 text-sm transition hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <span className="w-4" />}
            <div className="min-w-0">
              <div className="truncate font-medium" title={row.label}>{row.label}</div>
              <code className="truncate text-[11px] text-muted-foreground/70" title={row.name}>
                {row.name}
              </code>
            </div>
            <p className="line-clamp-1 text-xs text-muted-foreground" title={row.description ?? ''}>
              {row.description ?? ''}
            </p>
            <div className="flex items-center gap-2">
              {showTypeBadge && (
                <Badge variant="secondary" className="text-[10px]">{typeLabel(row.type)}</Badge>
              )}
              {row.updatedAt && (
                <span className="hidden text-[10px] text-muted-foreground/70 md:inline" title={row.updatedAt}>
                  {formatRelative(row.updatedAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {canPreview && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100"
                  title="Preview"
                  aria-label={`Preview ${row.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview(row);
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              <ChevronRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-foreground"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
