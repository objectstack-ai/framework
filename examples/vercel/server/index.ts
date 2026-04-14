// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Vercel Serverless API Entrypoint
 *
 * This module boots the ObjectStack kernel on the first request and
 * delegates all /api/* traffic to the ObjectStack Hono adapter.
 *
 * The kernel is initialized lazily (singleton pattern) and persists
 * across warm invocations for better performance.
 *
 * Uses `getRequestListener()` from `@hono/node-server` to handle
 * Vercel's pre-buffered request body (see extractBody helper).
 */

import { ObjectKernel } from '@objectstack/runtime';
import { createHonoApp } from '@objectstack/hono';
import { getRequestListener } from '@hono/node-server';
import type { Hono } from 'hono';
import config from '../objectstack.config.js';

// ---------------------------------------------------------------------------
// Singleton state — persists across warm Vercel invocations
// ---------------------------------------------------------------------------

let _kernel: ObjectKernel | null = null;
let _app: Hono | null = null;

/** Shared boot promise — prevents concurrent cold-start races. */
let _bootPromise: Promise<ObjectKernel> | null = null;

// ---------------------------------------------------------------------------
// Kernel bootstrap
// ---------------------------------------------------------------------------

/**
 * Boot the ObjectStack kernel (one-time cold-start cost).
 *
 * Uses a shared promise so that concurrent requests during a cold start
 * wait for the same boot sequence rather than starting duplicates.
 */
async function ensureKernel(): Promise<ObjectKernel> {
  if (_kernel) return _kernel;
  if (_bootPromise) return _bootPromise;

  _bootPromise = (async () => {
    console.log('[Vercel] Booting ObjectStack Kernel...');

    try {
      const kernel = new ObjectKernel();

      // Load plugins from config
      if (config.plugins) {
        for (const plugin of config.plugins) {
          await kernel.use(plugin);
        }
      }

      await kernel.bootstrap();

      _kernel = kernel;
      console.log('[Vercel] Kernel ready.');
      return kernel;
    } catch (err) {
      // Clear the lock so the next request can retry
      _bootPromise = null;
      console.error('[Vercel] Kernel boot failed:', (err as any)?.message || err);
      throw err;
    }
  })();

  return _bootPromise;
}

// ---------------------------------------------------------------------------
// Hono app factory
// ---------------------------------------------------------------------------

/**
 * Get (or create) the Hono application backed by the ObjectStack kernel.
 */
async function ensureApp(): Promise<Hono> {
  if (_app) return _app;

  const kernel = await ensureKernel();
  _app = createHonoApp({ kernel, prefix: '/api/v1' });
  return _app;
}

// ---------------------------------------------------------------------------
// Body extraction — reads Vercel's pre-buffered request body
// ---------------------------------------------------------------------------

/** Shape of the Vercel-augmented IncomingMessage passed via `env.incoming`. */
interface VercelIncomingMessage {
  rawBody?: Buffer | string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

/** Shape of the env object provided by `getRequestListener` on Vercel. */
interface VercelEnv {
  incoming?: VercelIncomingMessage;
}

function extractBody(
  incoming: VercelIncomingMessage,
  method: string,
  contentType: string | undefined,
): BodyInit | null {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  if (incoming.rawBody != null) {
    return incoming.rawBody;
  }

  if (incoming.body != null) {
    if (typeof incoming.body === 'string') return incoming.body;
    if (contentType?.includes('application/json')) return JSON.stringify(incoming.body);
    return String(incoming.body);
  }

  return null;
}

/**
 * Derive the correct public URL for the request, fixing the protocol when
 * running behind a reverse proxy such as Vercel's edge network.
 */
function resolvePublicUrl(
  requestUrl: string,
  incoming: VercelIncomingMessage | undefined,
): string {
  if (!incoming) return requestUrl;
  const fwdProto = incoming.headers?.['x-forwarded-proto'];
  const rawProto = Array.isArray(fwdProto) ? fwdProto[0] : fwdProto;
  const proto = rawProto === 'https' || rawProto === 'http' ? rawProto : undefined;
  if (proto === 'https' && requestUrl.startsWith('http:')) {
    return requestUrl.replace(/^http:/, 'https:');
  }
  return requestUrl;
}

// ---------------------------------------------------------------------------
// Vercel serverless handler
// ---------------------------------------------------------------------------

export default getRequestListener(async (request, env) => {
  let app: Hono;
  try {
    app = await ensureApp();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Vercel] Handler error — bootstrap did not complete:', message);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'Service Unavailable — kernel bootstrap failed.',
          code: 503,
        },
      }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    );
  }

  const method = request.method.toUpperCase();
  const incoming = (env as VercelEnv)?.incoming;

  // Fix URL protocol using x-forwarded-proto
  const url = resolvePublicUrl(request.url, incoming);

  console.log(`[Vercel] ${method} ${url}`);

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && incoming) {
    const contentType = incoming.headers?.['content-type'];
    const contentTypeStr = Array.isArray(contentType) ? contentType[0] : contentType;
    const body = extractBody(incoming, method, contentTypeStr);
    if (body != null) {
      return await app.fetch(
        new Request(url, { method, headers: request.headers, body }),
      );
    }
  }

  // For GET/HEAD/OPTIONS (or body-less requests)
  return await app.fetch(
    new Request(url, { method, headers: request.headers }),
  );
});

/**
 * Vercel per-function configuration.
 */
export const config = {
  memory: 1024,
  maxDuration: 60,
};
