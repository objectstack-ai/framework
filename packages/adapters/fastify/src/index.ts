// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type ObjectKernel, HttpDispatcher, HttpDispatcherResult } from '@objectstack/runtime';

export interface FastifyAdapterOptions {
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
 * Registers ObjectStack routes as a Fastify plugin.
 * Provides Auth, GraphQL, Metadata, Data, and Storage routes.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { objectStackPlugin } from '@objectstack/fastify';
 *
 * const app = Fastify();
 * app.register(objectStackPlugin, { kernel, prefix: '/api' });
 * app.listen({ port: 3000 });
 * ```
 */
export async function objectStackPlugin(fastify: FastifyInstance, options: FastifyAdapterOptions) {
  const dispatcher = new HttpDispatcher(options.kernel);
  const prefix = options.prefix || '/api';

  const sendResult = (result: HttpDispatcherResult, reply: FastifyReply) => {
    if (result.handled) {
      if (result.response) {
        if (result.response.headers) {
          Object.entries(result.response.headers).forEach(([k, v]) => reply.header(k, v as string));
        }
        return reply.status(result.response.status).send(result.response.body);
      }
      if (result.result) {
        const response = result.result;
        if (response.type === 'redirect' && response.url) {
          return reply.redirect(response.url);
        }
        if (response.type === 'stream' && response.stream) {
          if (response.headers) {
            Object.entries(response.headers).forEach(([k, v]) => reply.header(k, v as string));
          }
          return reply.send(response.stream);
        }
        return reply.status(200).send(response);
      }
    }
    return reply.status(404).send({ success: false, error: { message: 'Not Found', code: 404 } });
  };

  const errorResponse = (err: any, reply: FastifyReply) => {
    return reply.status(err.statusCode || 500).send({
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        code: err.statusCode || 500,
      },
    });
  };

  // --- Discovery ---
  fastify.get(`${prefix}`, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ data: dispatcher.getDiscoveryInfo(prefix) });
  });

  // --- .well-known ---
  fastify.get('/.well-known/objectstack', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.redirect(prefix);
  });

  // --- Auth ---
  fastify.all(`${prefix}/auth/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const path = request.url.substring(`${prefix}/auth/`.length).split('?')[0];
      const method = request.method;

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
        const protocol = request.protocol || 'http';
        const host = request.hostname || 'localhost';
        const url = `${protocol}://${host}${request.url}`;
        const headers = new Headers();
        if (request.headers) {
          Object.entries(request.headers).forEach(([k, v]) => {
            if (typeof v === 'string') headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(', '));
          });
        }
        const init: RequestInit = { method, headers };
        if (method !== 'GET' && method !== 'HEAD' && request.body) {
          init.body = JSON.stringify(request.body);
          if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
          }
        }
        const webRequest = new Request(url, init);
        const response = await authService.handleRequest(webRequest);
        reply.status(response.status);
        response.headers.forEach((v: string, k: string) => reply.header(k, v));
        const text = await response.text();
        return reply.send(text);
      }

      // Fallback to dispatcher
      const body = method === 'GET' || method === 'HEAD' ? {} : (request.body as any) || {};
      const result = await dispatcher.handleAuth(path, method, body, { request: request.raw });
      return sendResult(result, reply);
    } catch (err: any) {
      return errorResponse(err, reply);
    }
  });

  // --- GraphQL ---
  fastify.post(`${prefix}/graphql`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await dispatcher.handleGraphQL(request.body as any, { request: request.raw });
      return reply.send(result);
    } catch (err: any) {
      return errorResponse(err, reply);
    }
  });

  // --- Metadata ---
  fastify.all(`${prefix}/meta/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const urlPath = request.url.split('?')[0];
      const subPath = urlPath.substring(`${prefix}/meta`.length);
      const method = request.method;
      const body = (method === 'PUT' || method === 'POST') ? request.body : undefined;
      const result = await dispatcher.handleMetadata(subPath, { request: request.raw }, method, body);
      return sendResult(result, reply);
    } catch (err: any) {
      return errorResponse(err, reply);
    }
  });

  fastify.all(`${prefix}/meta`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const method = request.method;
      const body = (method === 'PUT' || method === 'POST') ? request.body : undefined;
      const result = await dispatcher.handleMetadata('', { request: request.raw }, method, body);
      return sendResult(result, reply);
    } catch (err: any) {
      return errorResponse(err, reply);
    }
  });

  // --- Data ---
  fastify.all(`${prefix}/data/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const urlPath = request.url.split('?')[0];
      const subPath = urlPath.substring(`${prefix}/data`.length);
      const method = request.method;
      const body = (method === 'POST' || method === 'PATCH') ? request.body : {};
      const result = await dispatcher.handleData(subPath, method, body, request.query, { request: request.raw });
      return sendResult(result, reply);
    } catch (err: any) {
      return errorResponse(err, reply);
    }
  });

  // --- Storage ---
  fastify.all(`${prefix}/storage/*`, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const urlPath = request.url.split('?')[0];
      const subPath = urlPath.substring(`${prefix}/storage`.length);
      const method = request.method;
      const file = (request as any).file || (request.body as any)?.file;
      const result = await dispatcher.handleStorage(subPath, method, file, { request: request.raw });
      return sendResult(result, reply);
    } catch (err: any) {
      return errorResponse(err, reply);
    }
  });
}

/**
 * Fastify plugin that attaches the ObjectStack kernel to each request.
 */
export function objectStackDecorator(kernel: ObjectKernel) {
  return async function (fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (request) => {
      (request as any).objectStack = kernel;
    });
  };
}
