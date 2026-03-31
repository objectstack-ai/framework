// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { NextRequest, NextResponse } from 'next/server';
import { type ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export interface NextAdapterOptions {
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
 * Creates a route handler for Next.js App Router
 * Handles /api/[...objectstack] pattern
 *
 * Only auth, GraphQL, storage, and discovery need explicit handling.
 * All other routes delegate to `HttpDispatcher.dispatch()` automatically.
 */
export function createRouteHandler(options: NextAdapterOptions) {
  const dispatcher = new HttpDispatcher(options.kernel);
  const error = (msg: string, code: number = 500) => NextResponse.json({ success: false, error: { message: msg, code } }, { status: code });

  // Helper to convert DispatchResult to NextResponse
  const toResponse = (result: HttpDispatcherResult) => {
      if (result.handled) {
          if (result.response) {
               return NextResponse.json(result.response.body, { 
                   status: result.response.status, 
                   headers: result.response.headers 
               });
          }
          if (result.result) {
              const res = result.result;
              // Redirect
              if (res.type === 'redirect' && res.url) {
                  return NextResponse.redirect(res.url);
              }
              // Stream
              if (res.type === 'stream' && res.stream) {
                  return new NextResponse(res.stream, {
                      status: 200,
                      headers: res.headers
                  });
              }
              // If it's a standard response object (like from another fetch)
              // Next.js might handle it, or we return it directly
              return res; 
          }
      }
      return error('Not Found', 404);
  }

  return async function handler(req: NextRequest, { params }: { params: { objectstack: string[] } }) {
    const resolvedParams = await Promise.resolve(params);
    const segments = resolvedParams.objectstack || [];
    const method = req.method;
    
    // --- 0. Discovery Endpoint ---
    if (segments.length === 0 && method === 'GET') {
      return NextResponse.json({ data: await dispatcher.getDiscoveryInfo(options.prefix || '/api') });
    }

    try {
        const rawRequest = req;

        // --- 1. Auth (needs auth service integration) ---
        if (segments[0] === 'auth') {
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
             const response = await authService.handleRequest(req);
             // Convert Web Response to NextResponse
             const body = await response.text();
             const headers: Record<string, string> = {};
             response.headers.forEach((v: string, k: string) => { headers[k] = v; });
             return new NextResponse(body, { status: response.status, headers });
           }

           // Fallback to legacy dispatcher
           const subPath = segments.slice(1).join('/');
           const body = method === 'POST' ? await req.json().catch(() => ({})) : {};
           const result = await dispatcher.handleAuth(subPath, method, body, { request: req });
           return toResponse(result);
        }

        // --- 2. GraphQL (returns raw result, not HttpDispatcherResult) ---
        if (segments[0] === 'graphql' && method === 'POST') {
            const body = await req.json();
            const result = await dispatcher.handleGraphQL(body as any, { request: rawRequest } as any);
            return NextResponse.json(result);
        }

        // --- 3. Storage (needs formData parsing) ---
        if (segments[0] === 'storage') {
            const subPath = segments.slice(1).join('/');
            
            let file: any = undefined;
            if (method === 'POST' && subPath === 'upload') {
                const formData = await req.formData();
                file = formData.get('file');
            }

            const result = await dispatcher.handleStorage(subPath, method, file, { request: rawRequest });
            return toResponse(result);
        }

        // --- 4. Catch-all: delegate to dispatcher.dispatch() ---
        // Handles meta, data, packages, analytics, automation, i18n, ui,
        // openapi, custom API endpoints, and any future routes.
        const path = '/' + segments.join('/');

        let body: any = undefined;
        if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
            body = await req.json().catch(() => ({}));
        }

        const url = new URL(req.url);
        const queryParams: Record<string, any> = {};
        url.searchParams.forEach((val, key) => queryParams[key] = val);

        const result = await dispatcher.dispatch(method, path, body, queryParams, { request: rawRequest });
        return toResponse(result);

    } catch (err: any) {
        return error(err.message || 'Internal Server Error', err.statusCode || 500);
    }
  }
}

/**
 * Creates a discovery handler for Next.js App Router
 * Handles /.well-known/objectstack
 */
export function createDiscoveryHandler(options: NextAdapterOptions) {
  return async function discoveryHandler(req: NextRequest) {
      const apiPath = options.prefix || '/api';
      const url = new URL(req.url);
      const targetUrl = new URL(apiPath, url.origin);
      return NextResponse.redirect(targetUrl);
  }
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Result type for server actions
 */
export interface ServerActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: { message: string; code: number };
}

/**
 * Creates type-safe React Server Actions for ObjectStack data operations.
 * Each action maps to a dispatcher method and can be called directly from
 * React Server Components or client components via `"use server"`.
 *
 * @example
 * ```ts
 * // app/actions.ts
 * "use server";
 * import { createServerActions } from '@objectstack/nextjs';
 * import { kernel } from '@/lib/kernel';
 *
 * const actions = createServerActions({ kernel });
 *
 * export async function getAccounts() {
 *   return actions.query('account');
 * }
 *
 * export async function createAccount(formData: FormData) {
 *   return actions.create('account', {
 *     name: formData.get('name') as string,
 *   });
 * }
 * ```
 */
export function createServerActions(options: NextAdapterOptions) {
  const dispatcher = new HttpDispatcher(options.kernel);
  const emptyContext = { request: undefined };

  return {
    /**
     * Query records from an object
     */
    async query(objectName: string, params?: Record<string, any>): Promise<ServerActionResult> {
      try {
        const result = await dispatcher.handleData(`/${objectName}`, 'GET', {}, params || {}, emptyContext);
        if (result.handled && result.response) {
          return { success: true, data: result.response.body };
        }
        return { success: false, error: { message: 'Not found', code: 404 } };
      } catch (err: any) {
        return { success: false, error: { message: err.message || 'Internal Server Error', code: err.statusCode || 500 } };
      }
    },

    /**
     * Get a single record by ID
     */
    async getById(objectName: string, id: string): Promise<ServerActionResult> {
      try {
        const result = await dispatcher.handleData(`/${objectName}/${id}`, 'GET', {}, {}, emptyContext);
        if (result.handled && result.response) {
          return { success: true, data: result.response.body };
        }
        return { success: false, error: { message: 'Not found', code: 404 } };
      } catch (err: any) {
        return { success: false, error: { message: err.message || 'Internal Server Error', code: err.statusCode || 500 } };
      }
    },

    /**
     * Create a new record
     */
    async create(objectName: string, data: Record<string, any>): Promise<ServerActionResult> {
      try {
        const result = await dispatcher.handleData(`/${objectName}`, 'POST', data, {}, emptyContext);
        if (result.handled && result.response) {
          return { success: true, data: result.response.body };
        }
        return { success: false, error: { message: 'Create failed', code: 500 } };
      } catch (err: any) {
        return { success: false, error: { message: err.message || 'Internal Server Error', code: err.statusCode || 500 } };
      }
    },

    /**
     * Update a record by ID
     */
    async update(objectName: string, id: string, data: Record<string, any>): Promise<ServerActionResult> {
      try {
        const result = await dispatcher.handleData(`/${objectName}/${id}`, 'PATCH', data, {}, emptyContext);
        if (result.handled && result.response) {
          return { success: true, data: result.response.body };
        }
        return { success: false, error: { message: 'Update failed', code: 500 } };
      } catch (err: any) {
        return { success: false, error: { message: err.message || 'Internal Server Error', code: err.statusCode || 500 } };
      }
    },

    /**
     * Delete a record by ID
     */
    async remove(objectName: string, id: string): Promise<ServerActionResult> {
      try {
        const result = await dispatcher.handleData(`/${objectName}/${id}`, 'DELETE', {}, {}, emptyContext);
        if (result.handled && result.response) {
          return { success: true, data: result.response.body };
        }
        return { success: false, error: { message: 'Delete failed', code: 500 } };
      } catch (err: any) {
        return { success: false, error: { message: err.message || 'Internal Server Error', code: err.statusCode || 500 } };
      }
    },

    /**
     * Get metadata for objects
     */
    async getMetadata(path?: string): Promise<ServerActionResult> {
      try {
        const result = await dispatcher.handleMetadata(path || '', emptyContext, 'GET');
        if (result.handled && result.response) {
          return { success: true, data: result.response.body };
        }
        return { success: false, error: { message: 'Not found', code: 404 } };
      } catch (err: any) {
        return { success: false, error: { message: err.message || 'Internal Server Error', code: err.statusCode || 500 } };
      }
    },
  };
}
