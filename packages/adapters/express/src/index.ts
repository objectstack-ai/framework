// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { type Router, type Request, type Response, type NextFunction, Router as createRouter } from 'express';
import { type ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export interface ExpressAdapterOptions {
  kernel: ObjectKernel;
  prefix?: string;
}

/**
 * Auth service interface with handleRequest method
 */
interface AuthService {
  handleRequest(request: globalThis.Request): Promise<globalThis.Response>;
}

/**
 * Creates an Express Router with all ObjectStack route dispatchers.
 *
 * Only routes that need framework-specific handling (auth service, storage
 * file upload, GraphQL raw result, discovery wrapper) are registered explicitly.
 * All other routes are handled by a catch-all that delegates to
 * `HttpDispatcher.dispatch()`, making the adapter automatically support
 * new routes added to the dispatcher.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createExpressRouter } from '@objectstack/express';
 *
 * const app = express();
 * app.use('/api', createExpressRouter({ kernel }));
 * app.listen(3000);
 * ```
 */
export function createExpressRouter(options: ExpressAdapterOptions): Router {
  const router = createRouter();
  const dispatcher = new HttpDispatcher(options.kernel);
  const prefix = options.prefix || '/api';

  const sendResult = (result: HttpDispatcherResult, res: Response) => {
    if (result.handled) {
      if (result.response) {
        if (result.response.headers) {
          Object.entries(result.response.headers).forEach(([k, v]) => res.set(k, v as string));
        }
        return res.status(result.response.status).json(result.response.body);
      }
      if (result.result) {
        const response = result.result;
        if (response.type === 'redirect' && response.url) {
          return res.redirect(response.url);
        }
        if (response.type === 'stream' && response.stream) {
          if (response.headers) {
            Object.entries(response.headers).forEach(([k, v]) => res.set(k, v as string));
          }
          response.stream.pipe(res);
          return;
        }
        return res.status(200).json(response);
      }
    }
    return res.status(404).json({ success: false, error: { message: 'Not Found', code: 404 } });
  };

  const errorResponse = (err: any, res: Response) => {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        code: err.statusCode || 500,
      },
    });
  };

  // ─── Explicit routes (framework-specific handling required) ────────────────

  // --- Discovery ---
  router.get('/discovery', async (_req: Request, res: Response) => {
    res.json({ data: await dispatcher.getDiscoveryInfo(prefix) });
  });

  // --- Auth (needs auth service integration) ---
  router.all('/auth/{*path}', async (req: Request, res: Response) => {
    try {
      const path = (req.params as any).path;
      const method = req.method;

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
        const protocol = req.protocol || 'http';
        const host = req.get?.('host') || req.headers?.host || 'localhost';
        const url = `${protocol}://${host}${req.originalUrl || req.url}`;
        const headers = new Headers();
        if (req.headers) {
          Object.entries(req.headers).forEach(([k, v]) => {
            if (typeof v === 'string') headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(', '));
          });
        }
        const init: RequestInit = { method, headers };
        if (method !== 'GET' && method !== 'HEAD' && req.body) {
          init.body = JSON.stringify(req.body);
          if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
          }
        }
        const webRequest = new Request(url, init);
        const response = await authService.handleRequest(webRequest);
        res.status(response.status);
        response.headers.forEach((v: string, k: string) => res.set(k, v));
        const text = await response.text();
        return res.send(text);
      }

      // Fallback to dispatcher
      const body = method === 'GET' || method === 'HEAD' ? {} : req.body || {};
      const result = await dispatcher.handleAuth(path, method, body, { request: req, response: res });
      return sendResult(result, res);
    } catch (err: any) {
      return errorResponse(err, res);
    }
  });

  // --- GraphQL (returns raw result, not HttpDispatcherResult) ---
  router.post('/graphql', async (req: Request, res: Response) => {
    try {
      const result = await dispatcher.handleGraphQL(req.body, { request: req });
      return res.json(result);
    } catch (err: any) {
      return errorResponse(err, res);
    }
  });

  // --- Storage (needs file upload handling) ---
  router.all('/storage/{*path}', async (req: Request, res: Response) => {
    try {
      const subPath = '/' + (req.params as any).path;
      const method = req.method;
      const file = (req as any).file || (req as any).files?.file;
      const result = await dispatcher.handleStorage(subPath, method, file, { request: req });
      return sendResult(result, res);
    } catch (err: any) {
      return errorResponse(err, res);
    }
  });

  // ─── Catch-all: delegate to dispatcher.dispatch() ─────────────────────────
  // Handles meta, data, packages, analytics, automation, i18n, ui, openapi,
  // custom API endpoints, and any future routes added to HttpDispatcher.
  router.all('/{*path}', async (req: Request, res: Response) => {
    try {
      const subPath = '/' + (req.params as any).path;
      const method = req.method;
      const body = (method === 'POST' || method === 'PUT' || method === 'PATCH') ? req.body : undefined;
      const result = await dispatcher.dispatch(method, subPath, body, req.query, { request: req, response: res });
      return sendResult(result, res);
    } catch (err: any) {
      return errorResponse(err, res);
    }
  });

  return router;
}

/**
 * Middleware that attaches the ObjectStack kernel to the request.
 */
export function objectStackMiddleware(kernel: ObjectKernel) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as any).objectStack = kernel;
    next();
  };
}
