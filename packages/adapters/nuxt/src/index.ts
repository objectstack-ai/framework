// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import {
  createRouter,
  defineEventHandler,
  getQuery,
  readBody,
  sendRedirect,
  setResponseHeader,
  setResponseStatus,
  type H3Event,
  type Router,
} from 'h3';
import { type ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export interface NuxtAdapterOptions {
  kernel: ObjectKernel;
  prefix?: string;
}

/**
 * Auth service interface with handleRequest method
 */
interface AuthService {
  handleRequest(request: Request): Promise<Response>;
}

/**
 * Creates an h3 router with all ObjectStack route dispatchers.
 * Designed for use in Nuxt server routes or standalone h3 apps.
 *
 * Only routes that need framework-specific handling (auth service, storage
 * file upload, GraphQL raw result, discovery wrapper) are registered explicitly.
 * All other routes are handled by a catch-all that delegates to
 * `HttpDispatcher.dispatch()`, making the adapter automatically support
 * new routes added to the dispatcher.
 *
 * @example
 * ```ts
 * // server/api/[...].ts
 * import { createH3Router } from '@objectstack/nuxt';
 * import { kernel } from '../kernel';
 *
 * const router = createH3Router({ kernel });
 * export default defineEventHandler(router.handler);
 * ```
 */
export function createH3Router(options: NuxtAdapterOptions): Router {
  const router = createRouter();
  const dispatcher = new HttpDispatcher(options.kernel);
  const prefix = options.prefix || '/api';

  const errorJson = (event: H3Event, message: string, code: number = 500) => {
    setResponseStatus(event, code);
    return { success: false, error: { message, code } };
  };

  const toResponse = (event: H3Event, result: HttpDispatcherResult) => {
    if (result.handled) {
      if (result.response) {
        if (result.response.headers) {
          Object.entries(result.response.headers).forEach(([k, v]) =>
            setResponseHeader(event, k, v as string),
          );
        }
        setResponseStatus(event, result.response.status);
        return result.response.body;
      }
      if (result.result) {
        const res = result.result;
        if (res.type === 'redirect' && res.url) {
          return sendRedirect(event, res.url);
        }
        if (res.type === 'stream' && res.stream) {
          if (res.headers) {
            Object.entries(res.headers).forEach(([k, v]) =>
              setResponseHeader(event, k, v as string),
            );
          }
          return res.stream;
        }
        return res;
      }
    }
    return errorJson(event, 'Not Found', 404);
  };

  // ─── Explicit routes (framework-specific handling required) ────────────────

  // --- Discovery ---
  router.get(
    `${prefix}`,
    defineEventHandler(async () => {
      return { data: await dispatcher.getDiscoveryInfo(prefix) };
    }),
  );

  // --- .well-known ---
  router.get(
    '/.well-known/objectstack',
    defineEventHandler((event) => {
      return sendRedirect(event, prefix);
    }),
  );

  // --- Auth (needs auth service integration) ---
  router.use(
    `${prefix}/auth/**`,
    defineEventHandler(async (event) => {
      try {
        const urlPath = event.path || event.node.req.url || '';
        const path = urlPath.substring(`${prefix}/auth/`.length).split('?')[0];
        const method = event.method;

        // Try AuthPlugin service first (prefer async to support factory-based services)
        let authService: AuthService | null = null;
        try {
          if (typeof options.kernel.getServiceAsync === 'function') {
            authService = await options.kernel.getServiceAsync<AuthService>('auth');
          } else if (typeof options.kernel.getService === 'function') {
            authService = options.kernel.getService<AuthService>('auth');
          }
        } catch {
          // Service not registered — fall through to dispatcher
          authService = null;
        }

        if (authService && typeof authService.handleRequest === 'function') {
          const host = event.node.req.headers.host || 'localhost';
          const protocol = (event.node.req.socket as any)?.encrypted ? 'https' : 'http';
          const url = `${protocol}://${host}${urlPath}`;
          const headers = new Headers();
          if (event.node.req.headers) {
            Object.entries(event.node.req.headers).forEach(([k, v]) => {
              if (typeof v === 'string') headers.set(k, v);
              else if (Array.isArray(v)) headers.set(k, v.join(', '));
            });
          }
          const init: RequestInit = { method, headers };
          if (method !== 'GET' && method !== 'HEAD') {
            const body = await readBody(event);
            if (body) {
              init.body = typeof body === 'string' ? body : JSON.stringify(body);
              if (!headers.has('content-type')) {
                headers.set('content-type', 'application/json');
              }
            }
          }
          const webRequest = new Request(url, init);
          const response = await authService.handleRequest(webRequest);
          setResponseStatus(event, response.status);
          response.headers.forEach((v: string, k: string) => setResponseHeader(event, k, v));
          return await response.text();
        }

        // Fallback to dispatcher
        const body = method === 'GET' || method === 'HEAD'
          ? {}
          : await readBody(event).catch(() => ({}));
        const result = await dispatcher.handleAuth(path, method, body, { request: event.node.req });
        return toResponse(event, result);
      } catch (err: any) {
        return errorJson(event, err.message || 'Internal Server Error', err.statusCode || 500);
      }
    }),
  );

  // --- GraphQL (returns raw result, not HttpDispatcherResult) ---
  router.post(
    `${prefix}/graphql`,
    defineEventHandler(async (event) => {
      try {
        const body = await readBody(event);
        const result = await dispatcher.handleGraphQL(body, { request: event.node.req });
        return result;
      } catch (err: any) {
        return errorJson(event, err.message || 'Internal Server Error', err.statusCode || 500);
      }
    }),
  );

  // --- Storage (needs multipart form parsing) ---
  router.use(
    `${prefix}/storage/**`,
    defineEventHandler(async (event) => {
      try {
        const urlPath = (event.path || event.node.req.url || '').split('?')[0];
        const subPath = urlPath.substring(`${prefix}/storage`.length);
        const method = event.method;
        const file = undefined; // File upload requires multipart parsing (e.g., formidable)
        const result = await dispatcher.handleStorage(subPath, method, file, { request: event.node.req });
        return toResponse(event, result);
      } catch (err: any) {
        return errorJson(event, err.message || 'Internal Server Error', err.statusCode || 500);
      }
    }),
  );

  // ─── Catch-all: delegate to dispatcher.dispatch() ─────────────────────────
  // Handles meta, data, packages, analytics, automation, i18n, ui, openapi,
  // custom API endpoints, and any future routes added to HttpDispatcher.
  router.use(
    `${prefix}/**`,
    defineEventHandler(async (event) => {
      try {
        const urlPath = (event.path || event.node.req.url || '').split('?')[0];
        const subPath = urlPath.substring(prefix.length);
        const method = event.method;
        const body = (method === 'POST' || method === 'PUT' || method === 'PATCH')
          ? await readBody(event)
          : undefined;
        const query = getQuery(event);
        const result = await dispatcher.dispatch(method, subPath, body, query, { request: event.node.req });
        return toResponse(event, result);
      } catch (err: any) {
        return errorJson(event, err.message || 'Internal Server Error', err.statusCode || 500);
      }
    }),
  );

  return router;
}
