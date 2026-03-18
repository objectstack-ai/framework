// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Hono } from 'hono';
import { type ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export interface ObjectStackHonoOptions {
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
 * Middleware mode for existing Hono apps
 */
export function objectStackMiddleware(kernel: ObjectKernel) {
  return async (c: any, next: any) => {
    c.set('objectStack', kernel);
    await next();
  };
}

/**
 * Creates a full-featured Hono app with all ObjectStack route dispatchers.
 *
 * Only routes that need framework-specific handling (auth service, storage
 * formData, GraphQL raw result, discovery wrapper) are registered explicitly.
 * All other routes (meta, data, packages, analytics, automation, i18n, ui,
 * openapi, custom endpoints, and any future routes) are handled by a
 * catch-all that delegates to `HttpDispatcher.dispatch()`.
 *
 * This means new routes added to `HttpDispatcher` automatically work in
 * every adapter without any adapter-side code changes.
 *
 * @example
 * ```ts
 * import { createHonoApp } from '@objectstack/hono';
 * const app = createHonoApp({ kernel });
 * export default app;
 * ```
 */
export function createHonoApp(options: ObjectStackHonoOptions): Hono {
  const app = new Hono();
  const prefix = options.prefix || '/api';
  const dispatcher = new HttpDispatcher(options.kernel);

  const errorJson = (c: any, message: string, code: number = 500) => {
    return c.json({ success: false, error: { message, code } }, code);
  };

  const toResponse = (c: any, result: HttpDispatcherResult) => {
    if (result.handled) {
      if (result.response) {
        if (result.response.headers) {
          Object.entries(result.response.headers).forEach(([k, v]) => c.header(k, v as string));
        }
        return c.json(result.response.body, result.response.status);
      }
      if (result.result) {
        const res = result.result;
        if (res.type === 'redirect' && res.url) {
          return c.redirect(res.url);
        }
        if (res.type === 'stream' && res.stream) {
          if (res.headers) {
            Object.entries(res.headers).forEach(([k, v]) => c.header(k, v as string));
          }
          return new Response(res.stream, { status: 200 });
        }
        return c.json(res, 200);
      }
    }
    return errorJson(c, 'Not Found', 404);
  };

  // ─── Explicit routes (framework-specific handling required) ────────────────

  // --- Discovery ---
  app.get(`${prefix}`, async (c) => {
    return c.json({ data: await dispatcher.getDiscoveryInfo(prefix) });
  });

  // --- .well-known ---
  app.get('/.well-known/objectstack', (c) => {
    return c.redirect(prefix);
  });

  // --- Auth (needs auth service integration) ---
  app.all(`${prefix}/auth/*`, async (c) => {
    try {
      const path = c.req.path.substring(`${prefix}/auth/`.length);
      const method = c.req.method;

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
        const response = await authService.handleRequest(c.req.raw);
        return new Response(response.body, {
          status: response.status,
          headers: response.headers,
        });
      }

      // Fallback to legacy dispatcher
      const body = method === 'GET' || method === 'HEAD'
        ? {}
        : await c.req.json().catch(() => ({}));
      const result = await dispatcher.handleAuth(path, method, body, { request: c.req.raw });
      return toResponse(c, result);
    } catch (err: any) {
      return errorJson(c, err.message || 'Internal Server Error', err.statusCode || 500);
    }
  });

  // --- GraphQL (returns raw result, not HttpDispatcherResult) ---
  app.post(`${prefix}/graphql`, async (c) => {
    try {
      const body = await c.req.json();
      const result = await dispatcher.handleGraphQL(body, { request: c.req.raw });
      return c.json(result);
    } catch (err: any) {
      return errorJson(c, err.message || 'Internal Server Error', err.statusCode || 500);
    }
  });

  // --- Storage (needs formData parsing) ---
  app.all(`${prefix}/storage/*`, async (c) => {
    try {
      const subPath = c.req.path.substring(`${prefix}/storage`.length);
      const method = c.req.method;

      let file: any = undefined;
      if (method === 'POST' && subPath === '/upload') {
        const formData = await c.req.formData();
        file = formData.get('file');
      }

      const result = await dispatcher.handleStorage(subPath, method, file, { request: c.req.raw });
      return toResponse(c, result);
    } catch (err: any) {
      return errorJson(c, err.message || 'Internal Server Error', err.statusCode || 500);
    }
  });

  // ─── Catch-all: delegate to dispatcher.dispatch() ─────────────────────────
  // Handles meta, data, packages, analytics, automation, i18n, ui, openapi,
  // custom API endpoints, and any future routes added to HttpDispatcher.
  app.all(`${prefix}/*`, async (c) => {
    try {
      const subPath = c.req.path.substring(prefix.length);
      const method = c.req.method;

      let body: any = undefined;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        body = await c.req.json().catch(() => ({}));
      }

      const queryParams: Record<string, any> = {};
      const url = new URL(c.req.url);
      url.searchParams.forEach((val, key) => { queryParams[key] = val; });

      const result = await dispatcher.dispatch(method, subPath, body, queryParams, { request: c.req.raw });
      return toResponse(c, result);
    } catch (err: any) {
      return errorJson(c, err.message || 'Internal Server Error', err.statusCode || 500);
    }
  });

  return app;
}
