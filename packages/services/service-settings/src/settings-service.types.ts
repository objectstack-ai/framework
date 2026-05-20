// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * SettingsService — the runtime implementation of ADR-0007.
 *
 * Responsibilities:
 *  - Maintain an in-memory registry of `SettingsManifest` instances.
 *  - Read/write values from the shared `sys_setting` K/V table via the
 *    `objectql` data engine, with an in-memory fallback so the service
 *    is usable before a real persistence layer is wired up (e.g. unit
 *    tests, bootstrap, control-plane mock).
 *  - Resolve effective values with `Env > Tenant > User > Default`
 *    precedence and tag every value with provenance.
 *  - Encrypt-at-rest for `encrypted: true` specifiers using a pluggable
 *    {@link CryptoAdapter}.
 *  - Emit `sys_audit_log` rows for every successful write (encrypted
 *    values are masked).
 *  - Dispatch `runAction` for `action_button` specifiers — used by
 *    "Test connection" / "Send test email" etc.
 *
 * The service is intentionally framework-agnostic: it doesn't import
 * the HTTP server, the plugin context, or the audit object schema. The
 * plugin wires those pieces up.
 */

import type {
  SettingsManifest,
  ResolvedSettingValue,
  SettingsNamespacePayload,
  SettingsActionResult,
  SpecifierScope,
} from '@objectstack/spec/system';
import { CryptoAdapter, NoopCryptoAdapter } from './crypto-adapter.js';

/** Caller identity used by the resolver and audit log. */
export interface SettingsContext {
  /** Calling user id, when known. Required for `scope: 'user'` reads. */
  userId?: string;
  /** Tenant / project id. Reserved for multi-tenant deployments. */
  tenantId?: string;
  /** Permissions held by the caller (used by REST authz). */
  permissions?: string[];
  /** Source IP / request id for audit correlation. */
  requestId?: string;
}

/** Storage row shape used by both the engine and the in-memory store. */
export interface SettingsRow {
  namespace: string;
  key: string;
  scope: SpecifierScope;
  user_id: string | null;
  value: unknown | null;
  value_enc: string | null;
  encrypted: boolean;
  updated_at?: string;
  updated_by?: string | null;
}

/**
 * Minimal data-engine surface used by the SettingsService. Mirrors the
 * methods we actually call so we can stub it cleanly in tests without
 * pulling the whole `IDataEngine`.
 */
export interface SettingsEngine {
  find(objectName: string, opts: { where?: Record<string, unknown>; limit?: number }): Promise<any[]>;
  insert(objectName: string, data: Record<string, unknown>): Promise<any>;
  update(objectName: string, opts: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<any>;
  delete?(objectName: string, opts: { where: Record<string, unknown> }): Promise<any>;
}

/** Optional audit hook — service-settings won't crash if absent. */
export interface SettingsAuditSink {
  record(entry: {
    namespace: string;
    key: string;
    scope: SpecifierScope;
    userId?: string;
    actor?: string;
    action: 'set' | 'reset';
    valueDigest: string;
    encrypted: boolean;
    requestId?: string;
  }): Promise<void> | void;
}

/** Action handler signature for `Specifier.type === 'action_button'`. */
export type SettingsActionHandler = (input: {
  namespace: string;
  actionId: string;
  values: Record<string, unknown>;
  payload?: unknown;
  ctx: SettingsContext;
}) => Promise<SettingsActionResult> | SettingsActionResult;

export interface SettingsServiceOptions {
  /** Persistence engine. When undefined, an in-memory store is used. */
  engine?: SettingsEngine;
  /** Crypto adapter for `encrypted` values. Defaults to NoopCryptoAdapter. */
  crypto?: CryptoAdapter;
  /** Audit sink. When undefined, writes still succeed but are not logged. */
  audit?: SettingsAuditSink;
  /**
   * `process.env`-like map. Defaults to `process.env`. Injected so
   * unit tests can simulate locked values without polluting the host
   * environment.
   */
  env?: Record<string, string | undefined>;
  /** Object name backing the K/V store. Defaults to 'sys_setting'. */
  objectName?: string;
}

const DEFAULT_OBJECT = 'sys_setting';

/**
 * Convert `(namespace, key)` to the env var convention defined in
 * ADR-0007: uppercase, dots → underscores, hyphens → underscores.
 */
export function envKeyOf(namespace: string, key: string): string {
  const slug = `${namespace}_${key}`.replace(/[.-]/g, '_').toUpperCase();
  return slug;
}

/** Cast an env string to the type hinted by the manifest default. */
function coerceEnvValue(raw: string, hint: unknown): unknown {
  if (typeof hint === 'boolean') return raw === 'true' || raw === '1' || raw === 'yes';
  if (typeof hint === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (Array.isArray(hint) || (hint && typeof hint === 'object')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Thrown when a caller tries to write a value pinned by env. */
export class SettingsLockedError extends Error {
  readonly code = 'SETTINGS_LOCKED' as const;
  constructor(
    readonly namespace: string,
    readonly key: string,
    readonly reason = 'locked-by-env',
  ) {
    super(`Setting '${namespace}.${key}' is locked (${reason}).`);
  }
}

/** Thrown when the requested namespace has no registered manifest. */
export class UnknownNamespaceError extends Error {
  readonly code = 'SETTINGS_UNKNOWN_NAMESPACE' as const;
  constructor(readonly namespace: string) {
    super(`No settings manifest registered for namespace '${namespace}'.`);
  }
}

/** Thrown when a key isn't declared by the namespace's manifest. */
export class UnknownKeyError extends Error {
  readonly code = 'SETTINGS_UNKNOWN_KEY' as const;
  constructor(readonly namespace: string, readonly key: string) {
    super(`Key '${key}' is not declared in manifest '${namespace}'.`);
  }
}
