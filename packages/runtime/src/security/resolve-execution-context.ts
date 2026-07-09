// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * resolveExecutionContext — REST/dispatcher entry-point identity resolver.
 *
 * Thin adapter over the SINGLE shared authorization resolver
 * (`resolveAuthzContext` in `@objectstack/core/security`). This function only
 * does the transport-specific plumbing — pull `ql` and the better-auth session
 * getter out of the active kernel/scope — then delegates ALL identity +
 * position/permission/RLS aggregation to the shared resolver, and layers the
 * reference localization (timezone/locale) on top.
 *
 * The actual table reads (`sys_member` / `sys_user_position` /
 * `sys_*_permission_set`), the platform-admin derivation and the `ai_seat`
 * synthesis live in ONE place now (`@objectstack/core`), shared with the REST
 * server, so the two entry points can never drift on authorization again.
 *
 * Always resolves — never throws. Anonymous requests yield
 * `{ isSystem: false, positions: [], permissions: [] }`.
 */

import type { ExecutionContext } from '@objectstack/spec/kernel';

import {
  resolveAuthzContext,
  resolveLocalizationContext,
} from '@objectstack/core';

interface ResolveOptions {
  /** Function returning a service from the active kernel (or undefined). */
  getService: (name: string) => Promise<any> | any;
  /** Function returning the data engine (ObjectQL) for the active scope. */
  getQl: () => Promise<any> | any;
  /** The raw incoming HTTP request (Fetch Request, Node IncomingMessage, …). */
  request: any;
}

/**
 * Convert the dispatcher's plain `Record<string,string>` headers map into a Web
 * `Headers` instance so better-auth (which reads via `headers.get('cookie')`)
 * works uniformly.
 */
function toHeaders(input: any): any {
  if (!input) return new Headers();
  if (typeof Headers !== 'undefined' && input instanceof Headers) return input;
  const h = new Headers();
  if (typeof input.entries === 'function') {
    for (const [k, v] of input.entries()) h.set(String(k), String(v));
    return h;
  }
  for (const k of Object.keys(input)) {
    const v = (input as any)[k];
    if (v == null) continue;
    h.set(String(k), Array.isArray(v) ? v.join(',') : String(v));
  }
  return h;
}

export async function resolveExecutionContext(opts: ResolveOptions): Promise<ExecutionContext> {
  const headers = toHeaders(opts.request?.headers);
  const ql = await opts.getQl();

  // The auth service surfaces better-auth either as `.api` (legacy direct mount)
  // or via `await getApi()` (lazy plugin). Build a session getter that tolerates
  // both, and degrades to anonymous when auth isn't wired up.
  const getSession = async (h: any) => {
    try {
      const authService: any = await opts.getService('auth');
      let api: any = authService?.api;
      if (!api && typeof authService?.getApi === 'function') api = await authService.getApi();
      return await api?.getSession?.({ headers: h });
    } catch {
      return undefined;
    }
  };

  const authz = await resolveAuthzContext({ ql, headers, getSession });

  const ctx: ExecutionContext = {
    positions: authz.positions,
    permissions: authz.permissions,
    systemPermissions: authz.systemPermissions,
    isSystem: false,
  };
  if (authz.userId) ctx.userId = authz.userId;
  if (authz.tenantId) ctx.tenantId = authz.tenantId;
  if (authz.email) ctx.email = authz.email;
  if (authz.accessToken) ctx.accessToken = authz.accessToken;
  if (authz.tabPermissions) ctx.tabPermissions = authz.tabPermissions;
  (ctx as any).org_user_ids = authz.org_user_ids;

  // Anonymous → skip localization (no scope to resolve against); keep the engine
  // default. Authenticated → resolve reference timezone/locale/currency.
  if (authz.userId) {
    const settings = await Promise.resolve(opts.getService('settings')).catch(() => undefined);
    const localization = await resolveLocalizationContext({
      ql,
      settings,
      tenantId: authz.tenantId,
      userId: authz.userId,
    });
    ctx.timezone = localization.timezone;
    ctx.locale = localization.locale;
    if (localization.currency) ctx.currency = localization.currency;
  }

  return ctx;
}

/**
 * Typed sentinel error thrown by SecurityPlugin (and re-thrown here) when an
 * operation is denied. The dispatcher catches it and translates to HTTP 403.
 *
 * Kept structurally identical to `@objectstack/plugin-security`'s
 * `PermissionDeniedError` so `isPermissionDeniedError` matches whichever class
 * instance crosses the boundary, regardless of which package owns the actual
 * class identity at runtime.
 */
export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED';
  readonly statusCode = 403;
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.details = details;
  }
}

export function isPermissionDeniedError(e: unknown): e is PermissionDeniedError {
  if (!e || typeof e !== 'object') return false;
  const anyE = e as any;
  return (
    anyE.name === 'PermissionDeniedError' ||
    anyE.code === 'PERMISSION_DENIED' ||
    (typeof anyE.message === 'string' && anyE.message.startsWith('[Security] Access denied'))
  );
}
