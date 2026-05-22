// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Bridge between the Studio backend and the @object-ui rendering layer.
 *
 * @object-ui components (ObjectForm, ObjectGrid, ObjectKanban, …) accept a
 * `DataSource` instance to read schemas and records. This hook wraps the
 * `@object-ui/data-objectstack` adapter against the same base URL Studio
 * already uses (see `lib/config.ts`) and memoises it for the session.
 */

import { useMemo } from 'react';
import type { DataSource } from '@object-ui/types';
import { createObjectStackAdapter } from '@object-ui/data-objectstack';
import { getApiBaseUrl } from '@/lib/config';

let cached: DataSource | null = null;

/**
 * Normalize a possibly-malformed `$orderby` so the adapter doesn't trip.
 *
 * `@object-ui/plugin-grid` (≤5.x) serialises a `sort: [{field,order}]`
 * view spec into a SPACE-DELIMITED STRING (e.g. `"annual_revenue desc, name asc"`)
 * before handing it to the adapter as `$orderby`. The adapter then does
 * `Object.entries(string)`, which iterates the string by character and
 * produces nonsense like `sort=0,1,2,…,17` on the wire — server returns
 * zero rows. We fix this here by converting the broken string back into
 * the array-of-strings shape the adapter handles correctly
 * (e.g. `['-annual_revenue', 'name']`).
 */
function normalizeOrderBy(orderby: unknown): unknown {
  if (typeof orderby !== 'string') return orderby;
  // Match OData-style "field [asc|desc]" tokens separated by comma.
  const parts = orderby
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.map((p) => {
    const [field, dir] = p.split(/\s+/);
    if (!field) return p;
    return (dir || '').toLowerCase() === 'desc' ? `-${field}` : field;
  });
}

/** Wrap the adapter so we can repair malformed query params before they hit the API. */
function withQueryRepair(adapter: DataSource): DataSource {
  const wrapped: any = Object.create(adapter as any);
  const repair = (params: any) => {
    if (!params || typeof params !== 'object') return params;
    const fixed = { ...params };
    if (fixed.$orderby !== undefined) fixed.$orderby = normalizeOrderBy(fixed.$orderby);
    return fixed;
  };
  for (const method of ['find', 'findOne', 'count'] as const) {
    const original = (adapter as any)[method];
    if (typeof original === 'function') {
      wrapped[method] = function repairedCall(this: any, resource: string, ...rest: any[]) {
        const first = rest[0];
        // find/count: (resource, params); findOne: (resource, id, params)
        if (method === 'findOne') {
          rest[1] = repair(rest[1]);
        } else {
          rest[0] = repair(first);
        }
        return original.apply(adapter, [resource, ...rest]);
      };
    }
  }
  return wrapped as DataSource;
}

export function useObjectUiDataSource(): DataSource {
  return useMemo(() => {
    if (cached) return cached;
    const raw = createObjectStackAdapter({
      // Empty baseUrl ⇒ same-origin requests, which both standalone (Vite
      // proxy → :3000) and embedded (/_studio under the kernel) handle.
      baseUrl: getApiBaseUrl(),
    });
    cached = withQueryRepair(raw);
    return cached;
  }, []);
}
