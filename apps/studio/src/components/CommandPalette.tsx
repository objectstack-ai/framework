// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ⌘K Command Palette — global, keyboard-first navigation.
 *
 * Mirrors Linear / Raycast / Salesforce Quick Find: a single fuzzy input
 * over every metadata item, plus shortcuts to top-level routes. Open
 * with `Cmd+K` / `Ctrl+K`.
 *
 * Items are lazy-loaded the first time the palette opens, then cached
 * for the session. Metadata mutations broadcast through
 * `useMetadataSubscriptionCallback` invalidate the cache so the palette
 * stays current.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { useClient, useMetadataSubscriptionCallback } from '@objectstack/client-react';
import type { InstalledPackage } from '@objectstack/spec/kernel';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { STUDIO_NAV, navItemForType } from './studio-nav';

interface PaletteProps {
  selectedPackage: InstalledPackage | null;
}

interface MetadataHit {
  type: string;
  name: string;
  label: string;
  packageId: string;
}

const HIDDEN_TYPES = new Set(['plugin', 'kind']);

function resolveLabel(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'defaultValue' in val) return String((val as any).defaultValue);
  if (val && typeof val === 'object' && 'key' in val) return String((val as any).key);
  return '';
}

export function CommandPalette({ selectedPackage }: PaletteProps) {
  const client = useClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MetadataHit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const pkgId = selectedPackage?.manifest?.id;

  // Global Cmd/Ctrl+K + click-on-search-bar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const customHandler = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('studio:command-palette:open', customHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('studio:command-palette:open', customHandler);
    };
  }, []);

  const loadAll = useCallback(async () => {
    if (!pkgId) return;
    try {
      const typesResult = await client.meta.getTypes();
      const types: string[] = typesResult?.types || (Array.isArray(typesResult) ? typesResult : []);
      const entries = await Promise.all(
        types
          .filter((t) => !HIDDEN_TYPES.has(t))
          .map(async (type) => {
            try {
              const res = await client.meta.getItems(type, { packageId: pkgId });
              const arr = res?.items || (Array.isArray(res) ? res : []);
              return arr.map((item: any) => ({
                type,
                name: item.name || item.id || 'unknown',
                label: resolveLabel(item.label) || item.name || 'Untitled',
                packageId: pkgId,
              }));
            } catch {
              return [] as MetadataHit[];
            }
          }),
      );
      setItems(entries.flat());
      setLoaded(true);
    } catch (err) {
      console.error('[CommandPalette] load failed', err);
    }
  }, [client, pkgId]);

  useEffect(() => {
    if (open && !loaded) loadAll();
  }, [open, loaded, loadAll]);

  // Invalidate on metadata changes
  useMetadataSubscriptionCallback('object', () => setLoaded(false));
  useMetadataSubscriptionCallback('view', () => setLoaded(false));
  useMetadataSubscriptionCallback('flow', () => setLoaded(false));
  useMetadataSubscriptionCallback('agent', () => setLoaded(false));

  const goTo = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  // Group by top-level nav category (Views & Apps, Automations, …) so the
  // palette doesn't show one heading per raw metadata type. Items whose
  // type isn't owned by any nav entry land in an "Other" bucket.
  const groupedItems = useMemo(() => {
    const map = new Map<string, { label: string; hits: MetadataHit[] }>();
    for (const it of items) {
      const nav = navItemForType(it.type);
      const key = nav?.key ?? 'other';
      const label = nav?.label ?? 'Other';
      const bucket = map.get(key) ?? { label, hits: [] };
      bucket.hits.push(it);
      map.set(key, bucket);
    }
    // Preserve STUDIO_NAV order; append "other" at the end.
    const ordered: Array<[string, { label: string; hits: MetadataHit[] }]> = [];
    for (const nav of STUDIO_NAV) {
      const b = map.get(nav.key);
      if (b) ordered.push([nav.key, b]);
    }
    const other = map.get('other');
    if (other) ordered.push(['other', other]);
    return ordered;
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 max-w-2xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          loop
          className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <Command.Input
            placeholder="Search objects, forms, views, flows… or type a route"
            className="flex h-12 w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-[480px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              {loaded ? 'No matches.' : 'Loading…'}
            </Command.Empty>

            {/* Top-level routes */}
            <Command.Group heading="Go to">
              {STUDIO_NAV.map((nav) => {
                const Icon = nav.icon;
                return (
                  <Command.Item
                    key={`nav-${nav.key}`}
                    value={`go ${nav.label} ${nav.hint}`}
                    onSelect={() => {
                      if (!pkgId) return;
                      goTo(nav.key === 'home' ? `/${pkgId}` : `/${pkgId}/${nav.key}`);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{nav.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{nav.hint}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {/* Metadata items grouped by top-level nav category */}
            {groupedItems.map(([navKey, bucket]) => {
              const Icon = STUDIO_NAV.find((n) => n.key === navKey)?.icon;
              return (
                <Command.Group key={`nav-group-${navKey}`} heading={bucket.label}>
                  {bucket.hits.slice(0, 50).map((hit) => (
                    <Command.Item
                      key={`${hit.type}-${hit.name}`}
                      value={`${hit.type} ${hit.name} ${hit.label}`}
                      onSelect={() => {
                        if (hit.type === 'object') {
                          goTo(`/${hit.packageId}/objects/${hit.name}`);
                        } else {
                          goTo(`/${hit.packageId}/metadata/${hit.type}/${hit.name}`);
                        }
                      }}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                    >
                      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                      <span className="truncate">{hit.label}</span>
                      <span className="ml-auto flex items-center gap-2 truncate font-mono text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                          {hit.type}
                        </span>
                        <span>{hit.name}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ navigate · ⏎ open · esc close</span>
            <span>⌘K</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
