// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useRecentItems — small localStorage-backed MRU list.
 *
 * Studio is metadata-heavy: users repeatedly bounce between the same
 * handful of objects / views / flows. An Airtable-style home page
 * surfaces a "Recent" list so common destinations are one click away.
 *
 * Storage shape (one record per visit, newest first, capped to 12):
 *   localStorage[`objectstack.recent.${packageId}`] = [
 *     { type: 'object', name: 'account', label: 'Account', ts: 17... },
 *     …
 *   ]
 *
 * We key by package so switching packages shows the right history.
 */

import { useCallback, useEffect, useState } from 'react';

export interface RecentItem {
  /** Metadata type, e.g. 'object', 'view', 'form'. */
  type: string;
  /** Item name (canonical, e.g. 'account'). */
  name: string;
  /** Display label as shown in the UI. */
  label?: string;
  /** Unix-ms timestamp of last visit. */
  ts: number;
}

const MAX = 12;

function keyFor(pkg: string | undefined): string {
  return `objectstack.recent.${pkg ?? 'global'}`;
}

function readSafe(pkg: string | undefined): RecentItem[] {
  try {
    const raw = localStorage.getItem(keyFor(pkg));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(it => it && it.type && it.name) : [];
  } catch {
    return [];
  }
}

export function useRecentItems(packageId: string | undefined) {
  const [items, setItems] = useState<RecentItem[]>(() => readSafe(packageId));

  // Reload when package changes.
  useEffect(() => { setItems(readSafe(packageId)); }, [packageId]);

  // Listen for cross-tab updates so opening the same object in two
  // tabs keeps the MRU consistent.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyFor(packageId)) setItems(readSafe(packageId));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [packageId]);

  const record = useCallback((item: Omit<RecentItem, 'ts'>) => {
    if (!item.type || !item.name) return;
    const next = readSafe(packageId).filter(
      it => !(it.type === item.type && it.name === item.name),
    );
    next.unshift({ ...item, ts: Date.now() });
    const trimmed = next.slice(0, MAX);
    try {
      localStorage.setItem(keyFor(packageId), JSON.stringify(trimmed));
    } catch { /* quota etc — ignore */ }
    setItems(trimmed);
  }, [packageId]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(keyFor(packageId)); } catch { /* ignore */ }
    setItems([]);
  }, [packageId]);

  return { items, record, clear };
}
