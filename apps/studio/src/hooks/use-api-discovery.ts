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

/** Shape of a single entry in the service endpoint catalog. */
interface ServiceEndpointEntry {
  method: HttpMethod;
  /** Relative path appended to the service route prefix (e.g. '/chat'). */
  path: string;
  desc: string;
  bodyTemplate?: Record<string, unknown>;
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

// ─── Service endpoint catalog ───────────────────────────────────────

/**
 * Well-known endpoints for each service, keyed by the service name
 * as it appears in the discovery response's `services` map.
 *
 * The `group` label used in the UI is derived from the map key.
 * Paths are relative to the service route prefix returned by discovery.
 *
 * This catalog is aligned with:
 *   - packages/spec/src/api/plugin-rest-api.zod.ts (DEFAULT_*_ROUTES)
 *   - packages/services/service-ai/src/routes/ai-routes.ts (buildAIRoutes)
 */
export const SERVICE_ENDPOINT_CATALOG: Record<string, { group: string; defaultRoute: string; endpoints: ServiceEndpointEntry[] }> = {
  ai: {
    group: 'AI',
    defaultRoute: '/api/v1/ai',
    endpoints: [
      { method: 'POST', path: '/chat', desc: 'Chat completion', bodyTemplate: { messages: [{ role: 'user', content: '' }] } },
      { method: 'POST', path: '/chat/stream', desc: 'Streaming chat (SSE)', bodyTemplate: { messages: [{ role: 'user', content: '' }] } },
      { method: 'POST', path: '/complete', desc: 'Text completion', bodyTemplate: { prompt: '' } },
      { method: 'GET', path: '/models', desc: 'List available models' },
      { method: 'POST', path: '/nlq', desc: 'Natural language query', bodyTemplate: { query: '' } },
      { method: 'POST', path: '/suggest', desc: 'AI-powered suggestions', bodyTemplate: { object: '', field: '', context: {} } },
      { method: 'POST', path: '/insights', desc: 'AI-generated insights', bodyTemplate: { object: '', recordIds: [] } },
      { method: 'POST', path: '/conversations', desc: 'Create conversation', bodyTemplate: {} },
      { method: 'GET', path: '/conversations', desc: 'List conversations' },
      { method: 'POST', path: '/conversations/:id/messages', desc: 'Add message to conversation', bodyTemplate: { role: 'user', content: '' } },
      { method: 'DELETE', path: '/conversations/:id', desc: 'Delete conversation' },
    ],
  },
  workflow: {
    group: 'Workflow',
    defaultRoute: '/api/v1/workflow',
    endpoints: [
      { method: 'GET', path: '/:object/config', desc: 'Get workflow configuration' },
      { method: 'GET', path: '/:object/:recordId/state', desc: 'Get workflow state' },
      { method: 'POST', path: '/:object/:recordId/transition', desc: 'Execute workflow transition', bodyTemplate: { targetState: '' } },
      { method: 'POST', path: '/:object/:recordId/approve', desc: 'Approve workflow step', bodyTemplate: { comment: '' } },
      { method: 'POST', path: '/:object/:recordId/reject', desc: 'Reject workflow step', bodyTemplate: { comment: '' } },
    ],
  },
  realtime: {
    group: 'Realtime',
    defaultRoute: '/api/v1/realtime',
    endpoints: [
      { method: 'POST', path: '/connect', desc: 'Establish realtime connection', bodyTemplate: { transport: 'websocket' } },
      { method: 'POST', path: '/disconnect', desc: 'Close realtime connection', bodyTemplate: { connectionId: '' } },
      { method: 'POST', path: '/subscribe', desc: 'Subscribe to channel', bodyTemplate: { channel: '' } },
      { method: 'POST', path: '/unsubscribe', desc: 'Unsubscribe from channel', bodyTemplate: { channel: '' } },
      { method: 'PUT', path: '/presence/:channel', desc: 'Set presence state', bodyTemplate: { status: 'online' } },
      { method: 'GET', path: '/presence/:channel', desc: 'Get channel presence' },
    ],
  },
  notification: {
    group: 'Notifications',
    defaultRoute: '/api/v1/notifications',
    endpoints: [
      { method: 'GET', path: '', desc: 'List notifications' }, // empty path → hits the base route prefix
      { method: 'POST', path: '/devices', desc: 'Register device for push', bodyTemplate: { token: '', platform: 'web' } },
      { method: 'DELETE', path: '/devices/:deviceId', desc: 'Unregister device' },
      { method: 'GET', path: '/preferences', desc: 'Get notification preferences' },
      { method: 'PATCH', path: '/preferences', desc: 'Update notification preferences', bodyTemplate: { email: true, push: true } },
      { method: 'POST', path: '/read', desc: 'Mark notifications as read', bodyTemplate: { ids: [] } },
      { method: 'POST', path: '/read/all', desc: 'Mark all as read' },
    ],
  },
  analytics: {
    group: 'Analytics',
    defaultRoute: '/api/v1/analytics',
    endpoints: [
      { method: 'POST', path: '/query', desc: 'Execute analytics query', bodyTemplate: { measures: [], dimensions: [] } },
      { method: 'GET', path: '/meta', desc: 'Get analytics metadata' },
    ],
  },
  automation: {
    group: 'Automation',
    defaultRoute: '/api/v1/automation',
    endpoints: [
      { method: 'POST', path: '/trigger', desc: 'Trigger automation', bodyTemplate: { name: '', params: {} } },
    ],
  },
  i18n: {
    group: 'i18n',
    defaultRoute: '/api/v1/i18n',
    endpoints: [
      { method: 'GET', path: '/locales', desc: 'Get available locales' },
      { method: 'GET', path: '/translations/:locale', desc: 'Get translations for locale' },
      { method: 'GET', path: '/labels/:object/:locale', desc: 'Get translated field labels' },
    ],
  },
  ui: {
    group: 'UI',
    defaultRoute: '/api/v1/ui',
    endpoints: [
      { method: 'GET', path: '/views', desc: 'List views' },
      { method: 'GET', path: '/views/:id', desc: 'Get view by ID' },
      { method: 'POST', path: '/views', desc: 'Create view', bodyTemplate: { name: '', object: '', type: 'list' } },
      { method: 'PATCH', path: '/views/:id', desc: 'Update view', bodyTemplate: { name: '' } },
      { method: 'DELETE', path: '/views/:id', desc: 'Delete view' },
    ],
  },
  feed: {
    group: 'Feed',
    defaultRoute: '/api/v1/feed',
    endpoints: [
      { method: 'GET', path: '/:object/:recordId', desc: 'Get feed items' },
      { method: 'POST', path: '/:object/:recordId', desc: 'Post feed item', bodyTemplate: { body: '' } },
    ],
  },
  storage: {
    group: 'Storage',
    defaultRoute: '/api/v1/storage',
    endpoints: [
      { method: 'POST', path: '/upload', desc: 'Upload file (multipart/form-data)' },
      { method: 'GET', path: '/:fileId', desc: 'Download file' },
      { method: 'DELETE', path: '/:fileId', desc: 'Delete file' },
    ],
  },
};

/**
 * Build endpoint definitions for a discovered service.
 *
 * @param serviceName  Key in the discovery `services` map (e.g. 'ai')
 * @param routePrefix  Base route path (e.g. '/api/v1/ai')
 */
export function buildServiceEndpoints(serviceName: string, routePrefix: string): EndpointDef[] {
  const catalog = SERVICE_ENDPOINT_CATALOG[serviceName];
  if (!catalog) return [];

  return catalog.endpoints.map(ep => ({
    method: ep.method,
    path: `${routePrefix}${ep.path}`,
    desc: ep.desc,
    group: catalog.group,
    ...(ep.bodyTemplate ? { bodyTemplate: ep.bodyTemplate } : {}),
  }));
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
      // 1. Fetch discovery response — the source of truth for available services
      let authBase = '/api/v1/auth';
      let discoveredServices: Record<string, { enabled: boolean; route?: string }> = {};
      let discoveredRoutes: Record<string, string> = {};

      try {
        const discRes = await fetch('/api/v1/discovery');
        if (discRes.ok) {
          const discData = await discRes.json();
          const data = discData?.data ?? discData;
          discoveredRoutes = data?.routes ?? {};
          discoveredServices = data?.services ?? {};
          if (discoveredRoutes.auth) authBase = discoveredRoutes.auth;
        }
      } catch {
        // Keep defaults — discovery may not be available
      }

      // 2. Build service endpoints from discovery
      const serviceEndpoints: EndpointDef[] = [];
      for (const [serviceName, catalog] of Object.entries(SERVICE_ENDPOINT_CATALOG)) {
        const serviceInfo = discoveredServices[serviceName] as
          | { enabled: boolean; status?: string; handlerReady?: boolean; route?: string }
          | undefined;

        // Only include services that are both enabled and have a handler ready.
        // Backwards-compatible: if handlerReady is not present (older backends),
        // treat status === 'available' or status === 'degraded' as equivalent to handlerReady: true.
        const isEnabled = serviceInfo?.enabled ?? false;
        const hasHandler = serviceInfo?.handlerReady
          ?? (serviceInfo?.status === 'available' || serviceInfo?.status === 'degraded');

        // Use route from discovery services, discovery routes map, or catalog default
        const routePrefix = serviceInfo?.route
          ?? discoveredRoutes[serviceName]
          ?? catalog.defaultRoute;

        if (isEnabled && hasHandler) {
          serviceEndpoints.push(...buildServiceEndpoints(serviceName, routePrefix));
        }
      }

      // 3. Fetch metadata types
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

      // 4. Fetch object names from metadata
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

      // 5. Build dynamic data endpoints for each object
      const dataEndpoints: EndpointDef[] = objectNames.flatMap(name => [
        { method: 'GET' as HttpMethod, path: `/api/v1/data/${name}`, desc: `List ${name}`, group: `Data: ${name}` },
        { method: 'POST' as HttpMethod, path: `/api/v1/data/${name}`, desc: `Create ${name}`, group: `Data: ${name}`, bodyTemplate: { name: 'example' } },
        { method: 'GET' as HttpMethod, path: `/api/v1/data/${name}/:id`, desc: `Get ${name} by ID`, group: `Data: ${name}` },
        { method: 'PATCH' as HttpMethod, path: `/api/v1/data/${name}/:id`, desc: `Update ${name}`, group: `Data: ${name}`, bodyTemplate: { name: 'updated' } },
        { method: 'DELETE' as HttpMethod, path: `/api/v1/data/${name}/:id`, desc: `Delete ${name}`, group: `Data: ${name}` },
      ]);

      // 6. Build metadata endpoints for each type
      const metaEndpoints: EndpointDef[] = metaTypes
        .filter(t => !EXCLUDED_META_TYPES.includes(t))
        .map(type => ({
          method: 'GET' as HttpMethod,
          path: `/api/v1/meta/${type}`,
          desc: `List ${type} metadata`,
          group: 'Metadata',
        }));

      // 7. Build per-object schema endpoints
      const schemaEndpoints: EndpointDef[] = objectNames.map(name => ({
        method: 'GET' as HttpMethod,
        path: `/api/v1/meta/object/${name}`,
        desc: `${name} schema`,
        group: 'Metadata',
      }));

      // 8. Combine all endpoints
      const all = [
        ...SYSTEM_ENDPOINTS,
        ...buildAuthEndpoints(authBase),
        ...serviceEndpoints,
        ...metaEndpoints,
        ...schemaEndpoints,
        ...dataEndpoints,
      ];

      // 9. Group endpoints
      const groupMap = new Map<string, EndpointDef[]>();
      for (const ep of all) {
        const existing = groupMap.get(ep.group) || [];
        existing.push(ep);
        groupMap.set(ep.group, existing);
      }

      // Sort groups: System, Auth, service groups, Metadata, then Data groups alphabetically
      const GROUP_SORT_ORDER = ['System', 'Auth', 'AI', 'Workflow', 'Realtime', 'Notifications', 'Analytics', 'Automation', 'i18n', 'UI', 'Feed', 'Storage', 'Metadata'];
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
