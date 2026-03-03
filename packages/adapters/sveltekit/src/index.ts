// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { type ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export interface SvelteKitAdapterOptions {
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
 * SvelteKit request event type (minimal interface to avoid hard dependency on @sveltejs/kit types at runtime)
 */
interface RequestEvent {
  request: Request;
  url: URL;
  params: Record<string, string>;
}

/**
 * Creates a SvelteKit request handler for ObjectStack API routes.
 * Use in a catch-all `+server.ts` route like `src/routes/api/[...path]/+server.ts`.
 *
 * @example
 * ```ts
 * // src/routes/api/[...path]/+server.ts
 * import { createRequestHandler } from '@objectstack/sveltekit';
 * import { kernel } from '$lib/kernel';
 *
 * const handler = createRequestHandler({ kernel });
 *
 * export const GET = handler;
 * export const POST = handler;
 * export const PUT = handler;
 * export const PATCH = handler;
 * export const DELETE = handler;
 * ```
 */
export function createRequestHandler(options: SvelteKitAdapterOptions) {
  const dispatcher = new HttpDispatcher(options.kernel);
  const prefix = options.prefix || '/api';

  const errorJson = (message: string, code: number = 500) => {
    return new Response(JSON.stringify({ success: false, error: { message, code } }), {
      status: code,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const toResponse = (result: HttpDispatcherResult): Response => {
    if (result.handled) {
      if (result.response) {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (result.response.headers) {
          Object.entries(result.response.headers).forEach(([k, v]) => headers.set(k, v as string));
        }
        return new Response(JSON.stringify(result.response.body), {
          status: result.response.status,
          headers,
        });
      }
      if (result.result) {
        const res = result.result;
        if (res.type === 'redirect' && res.url) {
          return new Response(null, {
            status: 302,
            headers: { Location: res.url },
          });
        }
        if (res.type === 'stream' && res.stream) {
          const headers = new Headers();
          if (res.headers) {
            Object.entries(res.headers).forEach(([k, v]) => headers.set(k, v as string));
          }
          return new Response(res.stream, { status: 200, headers });
        }
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return errorJson('Not Found', 404);
  };

  return async function handler(event: RequestEvent): Promise<Response> {
    const { request, url } = event;
    const method = request.method;
    const path = url.pathname.substring(prefix.length);
    const segments = path.split('/').filter(Boolean);

    // --- Discovery ---
    if (segments.length === 0 && method === 'GET') {
      return new Response(JSON.stringify({ data: dispatcher.getDiscoveryInfo(prefix) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // --- Auth ---
      if (segments[0] === 'auth') {
        const subPath = segments.slice(1).join('/');

        // Try AuthPlugin service first (prefer async to support factory-based services)
        let authService: AuthService | null = null;
        try {
          if (typeof options.kernel.getServiceAsync === 'function') {
            authService = await options.kernel.getServiceAsync<AuthService>('auth');
          } else if (typeof options.kernel.getService === 'function') {
            authService = options.kernel.getService<AuthService>('auth');
          }
        } catch {
          authService = null;
        }

        if (authService && typeof authService.handleRequest === 'function') {
          return await authService.handleRequest(request);
        }

        // Fallback to dispatcher
        const body = method === 'GET' || method === 'HEAD'
          ? {}
          : await request.json().catch(() => ({}));
        const result = await dispatcher.handleAuth(subPath, method, body, { request });
        return toResponse(result);
      }

      // --- GraphQL ---
      if (segments[0] === 'graphql' && method === 'POST') {
        const body = await request.json() as { query: string; variables?: any };
        const result = await dispatcher.handleGraphQL(body, { request });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // --- Metadata ---
      if (segments[0] === 'meta') {
        const subPath = segments.slice(1).join('/');
        let body: any = undefined;
        if (method === 'PUT' || method === 'POST') {
          body = await request.json().catch(() => ({}));
        }
        const result = await dispatcher.handleMetadata(
          subPath ? `/${subPath}` : '',
          { request },
          method,
          body,
        );
        return toResponse(result);
      }

      // --- Data ---
      if (segments[0] === 'data') {
        const subPath = segments.slice(1).join('/');
        let body: any = {};
        if (method === 'POST' || method === 'PATCH') {
          body = await request.json().catch(() => ({}));
        }
        const queryParams: Record<string, any> = {};
        url.searchParams.forEach((val, key) => { queryParams[key] = val; });

        const result = await dispatcher.handleData(
          subPath ? `/${subPath}` : '',
          method,
          body,
          queryParams,
          { request },
        );
        return toResponse(result);
      }

      // --- Storage ---
      if (segments[0] === 'storage') {
        const subPath = segments.slice(1).join('/');
        let file: any = undefined;
        if (method === 'POST' && subPath === 'upload') {
          const formData = await request.formData();
          file = formData.get('file');
        }
        const result = await dispatcher.handleStorage(
          subPath ? `/${subPath}` : '',
          method,
          file,
          { request },
        );
        return toResponse(result);
      }

      return errorJson('Not Found', 404);
    } catch (err: any) {
      return errorJson(err.message || 'Internal Server Error', err.statusCode || 500);
    }
  };
}

/**
 * Creates a SvelteKit handle hook that attaches the kernel to event.locals.
 *
 * @example
 * ```ts
 * // src/hooks.server.ts
 * import { createHandle } from '@objectstack/sveltekit';
 * export const handle = createHandle({ kernel });
 * ```
 */
export function createHandle(options: SvelteKitAdapterOptions) {
  return async function handle({ event, resolve }: { event: any; resolve: (event: any) => Promise<Response> }) {
    event.locals.objectStack = options.kernel;
    return resolve(event);
  };
}
