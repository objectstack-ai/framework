// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  SettingsManifest,
  ResolvedSettingValue,
  SettingsNamespacePayload,
  SettingsActionResult,
  SpecifierScope,
} from '@objectstack/spec/system';
import {
  type CryptoAdapter,
  NoopCryptoAdapter,
} from './crypto-adapter.js';
import {
  type SettingsActionHandler,
  type SettingsAuditSink,
  type SettingsContext,
  type SettingsEngine,
  type SettingsRow,
  type SettingsServiceOptions,
  envKeyOf,
  SettingsLockedError,
  UnknownKeyError,
  UnknownNamespaceError,
} from './settings-service.types.js';

const DEFAULT_OBJECT = 'sys_setting';

/**
 * Value-bearing specifier types — drives which entries we expect to
 * find in the K/V store. Keeps the resolver in sync with the spec
 * without importing the (large) Zod enum at runtime.
 */
const LAYOUT_ONLY_TYPES = new Set([
  'group',
  'info_banner',
  'child_pane',
  'title_value',
  'action_button',
]);

interface RegisteredManifest {
  manifest: SettingsManifest;
  /** Resolved specifier scopes for fast lookup. */
  scopes: Map<string, SpecifierScope>;
  /** Specifiers marked encrypted (or implicit for `password`). */
  encryptedKeys: Set<string>;
  /** Default values from the manifest, keyed by specifier key. */
  defaults: Map<string, unknown>;
  /** Action handlers registered alongside this manifest. */
  actions: Map<string, SettingsActionHandler>;
}

/**
 * Concrete SettingsService. See `src/settings-service.types.ts` for
 * the supporting types and `README.md` for the high-level contract.
 */
export class SettingsService {
  private readonly engine?: SettingsEngine;
  private readonly crypto: CryptoAdapter;
  private readonly audit?: SettingsAuditSink;
  private readonly env: Record<string, string | undefined>;
  private readonly objectName: string;
  private readonly registry = new Map<string, RegisteredManifest>();
  /** In-memory fallback when no engine is wired. */
  private readonly memory: SettingsRow[] = [];

  constructor(opts: SettingsServiceOptions = {}) {
    this.engine = opts.engine;
    this.crypto = opts.crypto ?? new NoopCryptoAdapter();
    this.audit = opts.audit;
    this.env = opts.env ?? (typeof process !== 'undefined' ? process.env : {});
    this.objectName = opts.objectName ?? DEFAULT_OBJECT;
  }

  // ---------------------------------------------------------------------
  // Manifest registry
  // ---------------------------------------------------------------------

  /** Register (or replace) a manifest. Idempotent. */
  registerManifest(manifest: SettingsManifest): void {
    const scopes = new Map<string, SpecifierScope>();
    const encryptedKeys = new Set<string>();
    const defaults = new Map<string, unknown>();
    const defaultScope = manifest.scope ?? 'tenant';
    for (const spec of manifest.specifiers) {
      if (!spec.key || LAYOUT_ONLY_TYPES.has(spec.type)) continue;
      scopes.set(spec.key, spec.scope ?? defaultScope);
      if (spec.encrypted || spec.type === 'password') encryptedKeys.add(spec.key);
      if (typeof spec.default !== 'undefined') defaults.set(spec.key, spec.default);
    }
    const prev = this.registry.get(manifest.namespace);
    const actions = prev?.actions ?? new Map<string, SettingsActionHandler>();
    this.registry.set(manifest.namespace, { manifest, scopes, encryptedKeys, defaults, actions });
  }

  /** Look up a manifest, or throw `UnknownNamespaceError`. */
  getManifest(namespace: string): SettingsManifest {
    const reg = this.registry.get(namespace);
    if (!reg) throw new UnknownNamespaceError(namespace);
    return reg.manifest;
  }

  /** List all registered manifests, optionally filtered by permission. */
  listManifests(ctx: SettingsContext = {}): SettingsManifest[] {
    const perms = new Set(ctx.permissions ?? []);
    const all = Array.from(this.registry.values()).map((r) => r.manifest);
    // Empty permissions ⇒ pass-through (server-side trust, e.g. boot tests).
    if (perms.size === 0) return all;
    return all.filter((m) => perms.has(m.readPermission ?? 'setup.access'));
  }

  /** Register a handler for an `action_button` declared in a manifest. */
  registerAction(namespace: string, actionId: string, handler: SettingsActionHandler): void {
    const reg = this.registry.get(namespace);
    if (!reg) throw new UnknownNamespaceError(namespace);
    reg.actions.set(actionId, handler);
  }

  // ---------------------------------------------------------------------
  // Resolver
  // ---------------------------------------------------------------------

  /** Resolve a single key. */
  async get<T = unknown>(
    namespace: string,
    key: string,
    ctx: SettingsContext = {},
  ): Promise<ResolvedSettingValue<T>> {
    const reg = this.registry.get(namespace);
    if (!reg) throw new UnknownNamespaceError(namespace);
    if (!reg.scopes.has(key)) throw new UnknownKeyError(namespace, key);

    // 1. env
    const envName = envKeyOf(namespace, key);
    const envRaw = this.env[envName];
    if (typeof envRaw === 'string') {
      const def = reg.defaults.get(key);
      return {
        value: coerceEnvValue(envRaw, def) as T,
        source: 'env',
        locked: true,
        lockedReason: `Set via env: ${envName}`,
      };
    }

    const scope = reg.scopes.get(key)!;
    const rows = await this.loadRows(namespace, scope === 'user' ? ctx.userId ?? null : null);

    // 2. tenant / user row
    const row = rows.find((r) => r.key === key && r.scope === scope);
    if (row) {
      const value = await this.materialiseRow(row);
      return {
        value: value as T,
        source: scope,
        locked: false,
      };
    }

    // 3. default
    const def = reg.defaults.get(key);
    return { value: (def ?? null) as T, source: 'default', locked: false };
  }

  /** Resolve every value in a namespace + return the manifest. */
  async getNamespace(
    namespace: string,
    ctx: SettingsContext = {},
  ): Promise<SettingsNamespacePayload> {
    const reg = this.registry.get(namespace);
    if (!reg) throw new UnknownNamespaceError(namespace);

    const values: Record<string, ResolvedSettingValue> = {};
    for (const [key] of reg.scopes) {
      values[key] = await this.get(namespace, key, ctx);
    }
    return { manifest: reg.manifest, values };
  }

  // ---------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------

  /** Persist a single key. Throws SettingsLockedError when env-locked. */
  async set(
    namespace: string,
    key: string,
    value: unknown,
    ctx: SettingsContext = {},
  ): Promise<ResolvedSettingValue> {
    return (await this.setMany(namespace, { [key]: value }, ctx))[key];
  }

  /** Persist multiple keys atomically (best-effort). */
  async setMany(
    namespace: string,
    patch: Record<string, unknown>,
    ctx: SettingsContext = {},
  ): Promise<Record<string, ResolvedSettingValue>> {
    const reg = this.registry.get(namespace);
    if (!reg) throw new UnknownNamespaceError(namespace);

    // Pre-flight: reject the whole batch if any key is locked or unknown.
    for (const key of Object.keys(patch)) {
      if (!reg.scopes.has(key)) throw new UnknownKeyError(namespace, key);
      const envRaw = this.env[envKeyOf(namespace, key)];
      if (typeof envRaw === 'string') throw new SettingsLockedError(namespace, key);
    }

    for (const [key, rawValue] of Object.entries(patch)) {
      const scope = reg.scopes.get(key)!;
      const userId = scope === 'user' ? ctx.userId ?? null : null;
      const isEncrypted = reg.encryptedKeys.has(key);
      const isNull = rawValue === null || typeof rawValue === 'undefined';

      let storedValue: unknown | null = null;
      let storedEnc: string | null = null;
      let digest = '';

      if (!isNull) {
        if (isEncrypted) {
          const plain = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
          storedEnc = await this.crypto.encrypt(plain, { namespace, key });
          digest = this.crypto.digest(plain);
        } else {
          storedValue = rawValue;
          digest = this.crypto.digest(stableStringify(rawValue));
        }
      }

      await this.upsertRow({
        namespace,
        key,
        scope,
        user_id: userId,
        value: storedValue,
        value_enc: storedEnc,
        encrypted: isEncrypted,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId ?? null,
      });

      if (this.audit) {
        await this.audit.record({
          namespace,
          key,
          scope,
          userId: ctx.userId,
          action: isNull ? 'reset' : 'set',
          valueDigest: isEncrypted ? '<encrypted:' + digest + '>' : digest,
          encrypted: isEncrypted,
          requestId: ctx.requestId,
        });
      }
    }

    // Re-resolve so callers see the post-write effective values.
    const out: Record<string, ResolvedSettingValue> = {};
    for (const key of Object.keys(patch)) {
      out[key] = await this.get(namespace, key, ctx);
    }
    return out;
  }

  /** Invoke a declared action (test connection, rotate, …). */
  async runAction(
    namespace: string,
    actionId: string,
    payload: unknown,
    ctx: SettingsContext = {},
  ): Promise<SettingsActionResult> {
    const reg = this.registry.get(namespace);
    if (!reg) throw new UnknownNamespaceError(namespace);
    const handler = reg.actions.get(actionId);
    if (!handler) {
      return {
        ok: false,
        severity: 'error',
        message: `No handler registered for action '${actionId}' in '${namespace}'.`,
      };
    }
    const values: Record<string, unknown> = {};
    for (const [key] of reg.scopes) {
      values[key] = (await this.get(namespace, key, ctx)).value;
    }
    try {
      return await handler({ namespace, actionId, values, payload, ctx });
    } catch (err: any) {
      return {
        ok: false,
        severity: 'error',
        message: err?.message ?? 'Action handler threw.',
      };
    }
  }

  // ---------------------------------------------------------------------
  // Persistence helpers (engine or in-memory)
  // ---------------------------------------------------------------------

  private async loadRows(namespace: string, userId: string | null): Promise<SettingsRow[]> {
    if (this.engine) {
      const where: Record<string, unknown> = { namespace };
      if (userId !== null) where.user_id = userId;
      const rows = await this.engine.find(this.objectName, { where });
      return rows.map((r) => ({
        namespace: r.namespace,
        key: r.key,
        scope: r.scope as SpecifierScope,
        user_id: r.user_id ?? null,
        value: r.value ?? null,
        value_enc: r.value_enc ?? null,
        encrypted: Boolean(r.encrypted),
        updated_at: r.updated_at,
        updated_by: r.updated_by ?? null,
      }));
    }
    return this.memory.filter(
      (r) => r.namespace === namespace && (userId === null || r.user_id === userId || r.scope === 'tenant'),
    );
  }

  private async upsertRow(row: SettingsRow): Promise<void> {
    if (this.engine) {
      const where: Record<string, unknown> = {
        namespace: row.namespace,
        key: row.key,
        scope: row.scope,
        user_id: row.user_id ?? null,
      };
      const existing = await this.engine.find(this.objectName, { where, limit: 1 });
      if (existing[0]) {
        await this.engine.update(this.objectName, { where, data: row });
      } else {
        await this.engine.insert(this.objectName, row);
      }
      return;
    }
    const idx = this.memory.findIndex(
      (r) =>
        r.namespace === row.namespace &&
        r.key === row.key &&
        r.scope === row.scope &&
        (r.user_id ?? null) === (row.user_id ?? null),
    );
    if (idx >= 0) this.memory[idx] = row;
    else this.memory.push(row);
  }

  private async materialiseRow(row: SettingsRow): Promise<unknown> {
    if (row.encrypted) {
      if (!row.value_enc) return null;
      const plain = await this.crypto.decrypt(row.value_enc, {
        namespace: row.namespace,
        key: row.key,
      });
      // Try JSON parse so non-string secrets round-trip.
      try {
        return JSON.parse(plain);
      } catch {
        return plain;
      }
    }
    return row.value ?? null;
  }
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Stable stringify so the audit digest is order-independent. */
function stableStringify(input: unknown): string {
  if (input === null || typeof input !== 'object') return JSON.stringify(input);
  if (Array.isArray(input)) return '[' + input.map(stableStringify).join(',') + ']';
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** Re-typed env coercer (the canonical one lives in settings-service.types). */
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
