// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * REST surface for the SettingsService — see ADR-0007 §REST.
 *
 *   GET    /api/settings                       → visible manifests
 *   GET    /api/settings/:namespace            → { manifest, values }
 *   PUT    /api/settings/:namespace            → batch upsert
 *   POST   /api/settings/:namespace/:actionId  → invoke declared action
 *
 * The route layer is a thin wrapper that maps thrown service errors
 * into proper HTTP status codes; all business logic lives in
 * `SettingsService`.
 */

import type { IHttpServer, IHttpRequest, IHttpResponse, RouteHandler } from '@objectstack/spec/contracts';
import { SettingsService } from './settings-service.js';
import {
  SettingsLockedError,
  SettingsValidationError,
  UnknownKeyError,
  UnknownNamespaceError,
  type SettingsContext,
} from './settings-service.types.js';

export interface SettingsRoutesOptions {
  /** Base path. Default `/api/settings`. */
  basePath?: string;
  /**
   * Extract caller identity from the request. The default reads
   * `x-user-id` / `x-tenant-id` headers and parses
   * `x-permissions` as a comma-separated list — fine for dev and
   * straightforward to override in production wiring.
   */
  contextFromRequest?: (req: IHttpRequest) => SettingsContext;
}

const defaultContext = (req: IHttpRequest): SettingsContext => {
  const header = (name: string): string | undefined => {
    const v = req.headers?.[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const perms = header('x-permissions');
  return {
    userId: header('x-user-id'),
    tenantId: header('x-tenant-id'),
    permissions: perms ? perms.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    requestId: header('x-request-id'),
  };
};

function sendError(res: IHttpResponse, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  res.status(status).json({ error: { code, message, ...extra } });
}

export function registerSettingsRoutes(
  http: IHttpServer,
  service: SettingsService,
  opts: SettingsRoutesOptions = {},
): void {
  const base = opts.basePath ?? '/api/settings';
  const ctxOf = opts.contextFromRequest ?? defaultContext;

  http.get(base, (async (req, res) => {
    try {
      const ctx = ctxOf(req);
      const manifests = service.listManifests(ctx);
      await res.json({ manifests });
    } catch (err: any) {
      sendError(res, 500, 'INTERNAL', err?.message ?? 'Failed to list manifests');
    }
  }) satisfies RouteHandler);

  http.get(`${base}/:namespace`, (async (req, res) => {
    const ns = req.params.namespace;
    try {
      const ctx = ctxOf(req);
      const payload = await service.getNamespace(ns, ctx);
      await res.json(payload);
    } catch (err: any) {
      if (err instanceof UnknownNamespaceError) {
        sendError(res, 404, 'UNKNOWN_NAMESPACE', err.message);
      } else {
        sendError(res, 500, 'INTERNAL', err?.message ?? 'Failed to read namespace');
      }
    }
  }) satisfies RouteHandler);

  http.put(`${base}/:namespace`, (async (req, res) => {
    const ns = req.params.namespace;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const ctx = ctxOf(req);
      const result = await service.setMany(ns, body, ctx);
      await res.json({ values: result });
    } catch (err: any) {
      if (err instanceof SettingsLockedError) {
        sendError(res, 409, 'SETTINGS_LOCKED', err.message, {
          namespace: err.namespace,
          key: err.key,
          reason: err.reason,
        });
      } else if (err instanceof UnknownNamespaceError) {
        sendError(res, 404, 'UNKNOWN_NAMESPACE', err.message);
      } else if (err instanceof UnknownKeyError) {
        sendError(res, 400, 'UNKNOWN_KEY', err.message, { namespace: err.namespace, key: err.key });
      } else if (err instanceof SettingsValidationError) {
        sendError(res, 400, 'SETTINGS_VALIDATION', err.message, {
          namespace: err.namespace,
          fields: err.fields,
        });
      } else {
        sendError(res, 500, 'INTERNAL', err?.message ?? 'Failed to write namespace');
      }
    }
  }) satisfies RouteHandler);

  http.post(`${base}/:namespace/:actionId`, (async (req, res) => {
    const { namespace, actionId } = req.params;
    try {
      const ctx = ctxOf(req);
      const result = await service.runAction(namespace, actionId, req.body, ctx);
      const status = result.ok ? 200 : 400;
      await res.status(status).json(result);
    } catch (err: any) {
      if (err instanceof UnknownNamespaceError) {
        sendError(res, 404, 'UNKNOWN_NAMESPACE', err.message);
      } else {
        sendError(res, 500, 'INTERNAL', err?.message ?? 'Action failed');
      }
    }
  }) satisfies RouteHandler);
}
