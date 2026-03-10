// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { useState, useEffect, useCallback } from 'react';
import { useClient } from '@objectstack/client-react';

// ─── Types ──────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export interface EndpointDef {
  method: HttpMethod;
  path: string;
  desc: string;
  group: string;
  bodyTemplate?: Record<string, unknown>;
}

export interface EndpointGroup {
  key: string;
  label: string;
  endpoints: EndpointDef[];
}

// ─── Static system endpoints ────────────────────────────────────────

/** Metadata types that should be excluded from the endpoint tree */
const EXCLUDED_META_TYPES = ['plugin', 'plugins', 'kind', 'package'];

const SYSTEM_ENDPOINTS: EndpointDef[] = [
  { method: 'GET', path: '/api/v1/discovery', desc: 'API Discovery', group: 'System' },
  { method: 'GET', path: '/api/v1/meta/types', desc: 'List metadata types', group: 'Metadata' },
  { method: 'GET', path: '/api/v1/packages', desc: 'List packages', group: 'System' },
  { method: 'GET', path: '/api/v1/health', desc: 'Health check', group: 'System' },
];

/** Build auth endpoints from the discovered auth base path. */
function buildAuthEndpoints(authBase: string): EndpointDef[] {
  return [
    { method: 'POST', path: `${authBase}/sign-in/email`, desc: 'Sign in (email)', group: 'Auth', bodyTemplate: { email: 'user@example.com', password: '' } },
    { method: 'POST', path: `${authBase}/sign-up/email`, desc: 'Sign up (email)', group: 'Auth', bodyTemplate: { email: '', password: '', name: '' } },
    { method: 'POST', path: `${authBase}/sign-out`, desc: 'Sign out', group: 'Auth' },
    { method: 'GET', path: `${authBase}/get-session`, desc: 'Get session', group: 'Auth' },
  ];
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useApiDiscovery() {
  const client = useClient();
  const [groups, setGroups] = useState<EndpointGroup[]>([]);
  const [allEndpoints, setAllEndpoints] = useState<EndpointDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const discover = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Resolve auth base path from discovery
      let authBase = '/api/v1/auth';
      try {
        const discRes = await fetch('/api/v1/discovery');
        if (discRes.ok) {
          const discData = await discRes.json();
          const routes = discData?.data?.routes ?? discData?.routes;
          if (routes?.auth) authBase = routes.auth;
        }
      } catch {
        // Keep default /api/v1/auth
      }

      // 2. Fetch metadata types
      let metaTypes: string[] = [];
      try {
        const typesResult = await client.meta.getTypes();
        if (typesResult && Array.isArray(typesResult.types)) {
          metaTypes = typesResult.types;
        } else if (Array.isArray(typesResult)) {
          metaTypes = typesResult as any;
        }
      } catch {
        // Meta types may not be available
      }

      // 3. Fetch object names from metadata
      let objectNames: string[] = [];
      try {
        const objectType = metaTypes.includes('objects') ? 'objects' : metaTypes.includes('object') ? 'object' : null;
        if (objectType) {
          const objectResult = await client.meta.getItems(objectType);
          let items: any[] = [];
          if (Array.isArray(objectResult)) items = objectResult;
          else if (objectResult && Array.isArray(objectResult.items)) items = objectResult.items;
          else if (objectResult && Array.isArray((objectResult as any).value)) items = (objectResult as any).value;
          objectNames = items.map((item: any) => item.name || item.id).filter(Boolean);
        }
      } catch {
        // Objects may not be available
      }

      // 4. Build dynamic data endpoints for each object
      const dataEndpoints: EndpointDef[] = objectNames.flatMap(name => [
        { method: 'GET' as HttpMethod, path: `/api/v1/data/${name}`, desc: `List ${name}`, group: `Data: ${name}` },
        { method: 'POST' as HttpMethod, path: `/api/v1/data/${name}`, desc: `Create ${name}`, group: `Data: ${name}`, bodyTemplate: { name: 'example' } },
        { method: 'GET' as HttpMethod, path: `/api/v1/data/${name}/:id`, desc: `Get ${name} by ID`, group: `Data: ${name}` },
        { method: 'PATCH' as HttpMethod, path: `/api/v1/data/${name}/:id`, desc: `Update ${name}`, group: `Data: ${name}`, bodyTemplate: { name: 'updated' } },
        { method: 'DELETE' as HttpMethod, path: `/api/v1/data/${name}/:id`, desc: `Delete ${name}`, group: `Data: ${name}` },
      ]);

      // 5. Build metadata endpoints for each type
      const metaEndpoints: EndpointDef[] = metaTypes
        .filter(t => !EXCLUDED_META_TYPES.includes(t))
        .map(type => ({
          method: 'GET' as HttpMethod,
          path: `/api/v1/meta/${type}`,
          desc: `List ${type} metadata`,
          group: 'Metadata',
        }));

      // 6. Build per-object schema endpoints
      const schemaEndpoints: EndpointDef[] = objectNames.map(name => ({
        method: 'GET' as HttpMethod,
        path: `/api/v1/meta/object/${name}`,
        desc: `${name} schema`,
        group: 'Metadata',
      }));

      // 7. Combine all endpoints
      const all = [
        ...SYSTEM_ENDPOINTS,
        ...buildAuthEndpoints(authBase),
        ...metaEndpoints,
        ...schemaEndpoints,
        ...dataEndpoints,
      ];

      // 8. Group endpoints
      const groupMap = new Map<string, EndpointDef[]>();
      for (const ep of all) {
        const existing = groupMap.get(ep.group) || [];
        existing.push(ep);
        groupMap.set(ep.group, existing);
      }

      // Sort groups: System, Auth, Metadata first, then Data groups alphabetically
      const GROUP_SORT_ORDER = ['System', 'Auth', 'Metadata'];
      const grouped = Array.from(groupMap.entries())
        .sort(([a], [b]) => {
          const aIdx = GROUP_SORT_ORDER.indexOf(a);
          const bIdx = GROUP_SORT_ORDER.indexOf(b);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.localeCompare(b);
        })
        .map(([key, endpoints]) => ({
          key,
          label: key,
          endpoints,
        }));

      setGroups(grouped);
      setAllEndpoints(all);
    } catch (err: any) {
      setError(err.message || 'Failed to discover APIs');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { discover(); }, [discover]);

  return { groups, allEndpoints, loading, error, refresh: discover };
}
