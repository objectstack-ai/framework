// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';

import { resolveExecutionContext } from './resolve-execution-context.js';
import { hashApiKey } from './api-key.js';

/**
 * Minimal ObjectQL stub. Only `sys_api_key` is populated; every other object
 * (sys_member, permission-set link tables, …) resolves to an empty set so the
 * tests isolate the API-key verify path.
 */
function makeQl(apiKeyRows: any[]) {
  return {
    async find(object: string, opts: any) {
      const where = opts?.where ?? {};
      if (object !== 'sys_api_key') return [];
      return apiKeyRows.filter((row) => {
        for (const [k, v] of Object.entries(where)) {
          if (row[k] !== v) return false;
        }
        return true;
      });
    },
  };
}

function makeOpts(apiKeyRows: any[], headers: Record<string, string>) {
  return {
    // No auth service wired — exercises the hand-rolled path only and lets the
    // session fallback degrade to anonymous.
    getService: async () => undefined,
    getQl: async () => makeQl(apiKeyRows),
    request: { headers },
  };
}

const FUTURE = '2999-01-01T00:00:00Z';
const PAST = '2000-01-01T00:00:00Z';

describe('resolveExecutionContext — API key verify path', () => {
  it('resolves a valid key to its owner via x-api-key', async () => {
    const raw = 'osk_valid_key';
    const rows = [
      { id: 'k1', key: hashApiKey(raw), revoked: false, user_id: 'u1', expires_at: FUTURE },
    ];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': raw }));
    expect(ctx.userId).toBe('u1');
    expect(ctx.isSystem).toBe(false);
  });

  it('resolves a valid key via Authorization: ApiKey <token>', async () => {
    const raw = 'osk_valid_key';
    const rows = [{ id: 'k1', key: hashApiKey(raw), revoked: false, user_id: 'u1' }];
    const ctx = await resolveExecutionContext(
      makeOpts(rows, { authorization: `ApiKey ${raw}` }),
    );
    expect(ctx.userId).toBe('u1');
  });

  it('rejects a revoked key', async () => {
    const raw = 'osk_revoked';
    const rows = [{ id: 'k1', key: hashApiKey(raw), revoked: true, user_id: 'u1' }];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': raw }));
    expect(ctx.userId).toBeUndefined();
  });

  it('rejects an expired key', async () => {
    const raw = 'osk_expired';
    const rows = [
      { id: 'k1', key: hashApiKey(raw), revoked: false, user_id: 'u1', expires_at: PAST },
    ];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': raw }));
    expect(ctx.userId).toBeUndefined();
  });

  it('rejects an unknown key', async () => {
    const rows = [
      { id: 'k1', key: hashApiKey('osk_real'), revoked: false, user_id: 'u1' },
    ];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': 'osk_wrong' }));
    expect(ctx.userId).toBeUndefined();
  });

  it('does NOT match a plaintext-stored key (only hashed lookup)', async () => {
    // A row whose `key` was (wrongly) stored as the raw value must never
    // authenticate — the resolver only ever queries by sha256(raw).
    const raw = 'osk_plaintext';
    const rows = [{ id: 'k1', key: raw, revoked: false, user_id: 'u1' }];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': raw }));
    expect(ctx.userId).toBeUndefined();
  });

  it('parses JSON-string scopes into ctx.permissions', async () => {
    const raw = 'osk_scoped';
    const rows = [
      {
        id: 'k1',
        key: hashApiKey(raw),
        revoked: false,
        user_id: 'u1',
        scopes: '["data:read","data:write"]',
      },
    ];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': raw }));
    expect(ctx.permissions).toContain('data:read');
    expect(ctx.permissions).toContain('data:write');
  });

  it('carries an organization_id through to tenantId when present', async () => {
    const raw = 'osk_org';
    const rows = [
      {
        id: 'k1',
        key: hashApiKey(raw),
        revoked: false,
        user_id: 'u1',
        organization_id: 'org1',
      },
    ];
    const ctx = await resolveExecutionContext(makeOpts(rows, { 'x-api-key': raw }));
    expect(ctx.userId).toBe('u1');
    expect(ctx.tenantId).toBe('org1');
  });

  it('returns an anonymous context when no auth header is present', async () => {
    const ctx = await resolveExecutionContext(makeOpts([], {}));
    expect(ctx.userId).toBeUndefined();
    expect(ctx.isSystem).toBe(false);
    expect(ctx.roles).toEqual([]);
    expect(ctx.permissions).toEqual([]);
  });

  it('ignores Bearer tokens on the API-key path (no key resolution)', async () => {
    const raw = 'osk_valid';
    const rows = [{ id: 'k1', key: hashApiKey(raw), revoked: false, user_id: 'u1' }];
    // Bearer is a session token, not an API key — must not resolve here.
    const ctx = await resolveExecutionContext(
      makeOpts(rows, { authorization: `Bearer ${raw}` }),
    );
    expect(ctx.userId).toBeUndefined();
  });
});

/**
 * Localization resolution (ADR-0053 Phase 2): reference `timezone` + `locale`
 * resolved from the `localization` settings. Canonical path is the `settings`
 * service (platform default → global → tenant); when it's absent the resolver
 * falls back to a direct tenant-scoped `sys_setting` read, then UTC / en-US.
 * Per-user overrides are intentionally out of scope (organization-level only),
 * so `sys_user_preference` is no longer consulted.
 */
describe('resolveExecutionContext — localization (timezone + locale)', () => {
  const RAW = 'osk_tz';
  const apiKeyRows = [{ id: 'k1', key: hashApiKey(RAW), revoked: false, user_id: 'u1', expires_at: FUTURE }];

  /** Fake `settings` service doing the 4-tier `get(namespace, key)` resolution. */
  function makeSettings(values: Record<string, unknown>) {
    return {
      async get(namespace: string, key: string) {
        return { value: values[`${namespace}.${key}`], source: 'tenant' };
      },
    };
  }

  function makeTzOpts({
    settings = [],
    prefs = [],
    settingsService,
  }: { settings?: any[]; prefs?: any[]; settingsService?: any }) {
    const tables: Record<string, any[]> = {
      sys_api_key: apiKeyRows,
      sys_user_preference: prefs,
      sys_setting: settings,
    };
    const ql = {
      async find(object: string, opts: any) {
        const rows = tables[object] ?? [];
        const where = opts?.where ?? {};
        return rows.filter((row) => {
          for (const [k, v] of Object.entries(where)) {
            if (v !== null && typeof v === 'object') continue; // skip $in/operators
            if (row[k] !== v) return false;
          }
          return true;
        });
      },
    };
    return {
      getService: async (name: string) => (name === 'settings' ? settingsService : undefined),
      getQl: async () => ql,
      request: { headers: { 'x-api-key': RAW } },
    };
  }

  it('resolves timezone + locale via the settings service when present', async () => {
    const ctx = await resolveExecutionContext(makeTzOpts({
      settingsService: makeSettings({
        'localization.timezone': 'Europe/Paris',
        'localization.locale': 'zh-CN',
      }),
    }));
    expect(ctx.userId).toBe('u1');
    expect(ctx.timezone).toBe('Europe/Paris');
    expect(ctx.locale).toBe('zh-CN');
  });

  it('falls back to a direct tenant-scoped sys_setting read when no settings service', async () => {
    const ctx = await resolveExecutionContext(makeTzOpts({
      settings: [
        { namespace: 'localization', key: 'timezone', scope: 'tenant', value: 'Asia/Tokyo' },
        { namespace: 'localization', key: 'locale', scope: 'tenant', value: 'ja-JP' },
      ],
    }));
    expect(ctx.timezone).toBe('Asia/Tokyo');
    expect(ctx.locale).toBe('ja-JP');
  });

  it('ignores per-user sys_user_preference rows (organization-level only)', async () => {
    const ctx = await resolveExecutionContext(makeTzOpts({
      prefs: [{ user_id: 'u1', key: 'timezone', value: 'America/New_York' }],
      settings: [{ namespace: 'localization', key: 'timezone', scope: 'tenant', value: 'Europe/Paris' }],
    }));
    expect(ctx.timezone).toBe('Europe/Paris'); // org default, NOT the user pref
  });

  it('defaults to UTC / en-US when nothing is configured', async () => {
    const ctx = await resolveExecutionContext(makeTzOpts({}));
    expect(ctx.timezone).toBe('UTC');
    expect(ctx.locale).toBe('en-US');
  });

  it('ignores an invalid zone and falls back to the built-in', async () => {
    const ctx = await resolveExecutionContext(makeTzOpts({
      settingsService: makeSettings({ 'localization.timezone': 'Not/AZone' }),
    }));
    expect(ctx.timezone).toBe('UTC');
  });

  it('leaves timezone/locale unset for anonymous requests', async () => {
    const ctx = await resolveExecutionContext({
      getService: async () => undefined,
      getQl: async () => ({ async find() { return []; } }),
      request: { headers: {} },
    });
    expect(ctx.userId).toBeUndefined();
    expect(ctx.timezone).toBeUndefined();
    expect(ctx.locale).toBeUndefined();
  });
});
