// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import { SettingsService } from './settings-service';
import { SettingsLockedError, UnknownKeyError, UnknownNamespaceError, envKeyOf } from './settings-service.types';
import { NoopCryptoAdapter } from './crypto-adapter';
import { mailSettingsManifest, mailTestActionHandler } from './manifests/mail.manifest';
import { brandingSettingsManifest } from './manifests/branding.manifest';
import { featureFlagsSettingsManifest } from './manifests/feature-flags.manifest';
import { SettingsManifestSchema } from '@objectstack/spec/system';

describe('reference manifests are spec-valid', () => {
  it('mail / branding / feature_flags pass schema', () => {
    expect(() => SettingsManifestSchema.parse(mailSettingsManifest)).not.toThrow();
    expect(() => SettingsManifestSchema.parse(brandingSettingsManifest)).not.toThrow();
    expect(() => SettingsManifestSchema.parse(featureFlagsSettingsManifest)).not.toThrow();
  });
});

describe('envKeyOf', () => {
  it('uppercases and underscores', () => {
    expect(envKeyOf('mail', 'smtp_host')).toBe('MAIL_SMTP_HOST');
    expect(envKeyOf('feature_flags', 'ai-enabled')).toBe('FEATURE_FLAGS_AI_ENABLED');
  });
});

describe('SettingsService — registry', () => {
  it('rejects unknown namespace', async () => {
    const svc = new SettingsService();
    await expect(svc.get('nope', 'x')).rejects.toBeInstanceOf(UnknownNamespaceError);
    expect(() => svc.getManifest('nope')).toThrow(UnknownNamespaceError);
  });

  it('rejects unknown key', async () => {
    const svc = new SettingsService();
    svc.registerManifest(brandingSettingsManifest);
    await expect(svc.get('branding', 'nope')).rejects.toBeInstanceOf(UnknownKeyError);
  });
});

describe('SettingsService — resolver precedence', () => {
  it('returns default when nothing set', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(brandingSettingsManifest);
    const r = await svc.get('branding', 'workspace_name');
    expect(r.source).toBe('default');
    expect(r.value).toBe('ObjectStack');
    expect(r.locked).toBe(false);
  });

  it('returns tenant value after set()', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(brandingSettingsManifest);
    await svc.set('branding', 'workspace_name', 'Acme');
    const r = await svc.get('branding', 'workspace_name');
    expect(r.source).toBe('tenant');
    expect(r.value).toBe('Acme');
    expect(r.locked).toBe(false);
  });

  it('env wins over tenant and locks the field', async () => {
    const svc = new SettingsService({ env: { BRANDING_WORKSPACE_NAME: 'EnvCorp' } });
    svc.registerManifest(brandingSettingsManifest);
    await svc.set('branding', 'workspace_name', 'Tenant').catch(() => {});
    const r = await svc.get('branding', 'workspace_name');
    expect(r.source).toBe('env');
    expect(r.value).toBe('EnvCorp');
    expect(r.locked).toBe(true);
    expect(r.lockedReason).toContain('BRANDING_WORKSPACE_NAME');
  });

  it('coerces env strings via default-type hint', async () => {
    const svc = new SettingsService({ env: { FEATURE_FLAGS_AI_ENABLED: 'true' } });
    svc.registerManifest(featureFlagsSettingsManifest);
    const r = await svc.get('feature_flags', 'ai_enabled');
    expect(r.value).toBe(true);
  });

  it('rejects writes against env-locked keys', async () => {
    const svc = new SettingsService({ env: { BRANDING_WORKSPACE_NAME: 'EnvCorp' } });
    svc.registerManifest(brandingSettingsManifest);
    await expect(svc.set('branding', 'workspace_name', 'X')).rejects.toBeInstanceOf(SettingsLockedError);
  });
});

describe('SettingsService — encryption round-trip', () => {
  it('persists encrypted=true values via crypto adapter', async () => {
    const svc = new SettingsService({ env: {}, crypto: new NoopCryptoAdapter() });
    svc.registerManifest(mailSettingsManifest);
    await svc.setMany('mail', { provider: 'sendgrid', api_key: 'sg-secret-123', from_email: 'a@b.com' });
    const ns = await svc.getNamespace('mail');
    expect(ns.values.api_key.value).toBe('sg-secret-123');
    expect(ns.values.api_key.source).toBe('global');
  });
});

describe('SettingsService — global scope', () => {
  it('mail manifest defaults to global scope', () => {
    expect(mailSettingsManifest.scope).toBe('global');
  });

  it('returns source="global" for platform-wide values', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    await svc.setMany('mail', { provider: 'smtp', from_email: 'ops@example.com' });
    const r = await svc.get('mail', 'from_email');
    expect(r.source).toBe('global');
    expect(r.value).toBe('ops@example.com');
    expect(r.locked).toBe(false);
  });

  it('global value is visible from any user context (no per-user isolation)', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    await svc.setMany('mail', { provider: 'smtp', from_email: 'ops@example.com' }, { userId: 'u1' });
    const fromU2 = await svc.get('mail', 'from_email', { userId: 'u2' });
    expect(fromU2.source).toBe('global');
    expect(fromU2.value).toBe('ops@example.com');
  });

  it('env still wins over global', async () => {
    const svc = new SettingsService({ env: { MAIL_FROM_EMAIL: 'env@example.com' } });
    svc.registerManifest(mailSettingsManifest);
    await svc.set('mail', 'from_email', 'global@example.com').catch(() => {});
    const r = await svc.get('mail', 'from_email');
    expect(r.source).toBe('env');
    expect(r.value).toBe('env@example.com');
    expect(r.locked).toBe(true);
  });
});

describe('SettingsService — audit sink', () => {
  it('records masked digest for encrypted values', async () => {
    const events: any[] = [];
    const svc = new SettingsService({
      env: {},
      audit: { record: (e) => events.push(e) },
    });
    svc.registerManifest(mailSettingsManifest);
    await svc.setMany('mail', { provider: 'sendgrid', api_key: 'top-secret', from_email: 'a@b.com' });
    const apiKeyEvent = events.find((e) => e.key === 'api_key');
    expect(apiKeyEvent).toBeTruthy();
    expect(apiKeyEvent.encrypted).toBe(true);
    expect(apiKeyEvent.valueDigest).toMatch(/^<encrypted:fnv32:/);
  });
});

describe('SettingsService — getNamespace', () => {
  it('returns manifest + values for every key', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(featureFlagsSettingsManifest);
    const payload = await svc.getNamespace('feature_flags');
    expect(payload.manifest.namespace).toBe('feature_flags');
    expect(payload.values.ai_enabled.value).toBe(false);
    expect(payload.values.inline_comments.value).toBe(true);
  });
});

describe('SettingsService — listManifests permission filter', () => {
  it('hides manifests for callers without read permission', () => {
    const svc = new SettingsService();
    svc.registerManifest(brandingSettingsManifest);
    svc.registerManifest(mailSettingsManifest);
    expect(svc.listManifests({ permissions: [] }).length).toBe(2); // empty = passthrough
    expect(svc.listManifests({ permissions: ['setup.access'] }).length).toBe(2);
    expect(svc.listManifests({ permissions: ['other'] }).length).toBe(0);
  });
});

describe('SettingsService — runAction', () => {
  it('returns an error for unregistered actions', async () => {
    const svc = new SettingsService();
    svc.registerManifest(mailSettingsManifest);
    const r = await svc.runAction('mail', 'nope', null);
    expect(r.ok).toBe(false);
  });

  it('invokes registered handler with current values', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    svc.registerAction('mail', 'test', mailTestActionHandler);
    await svc.setMany('mail', { provider: 'smtp', smtp_host: 'smtp.x', from_email: 'a@b.com' });
    const r = await svc.runAction('mail', 'test', null);
    expect(r.ok).toBe(true);
  });

  it('catches handler exceptions', async () => {
    const svc = new SettingsService();
    svc.registerManifest(brandingSettingsManifest);
    svc.registerAction('branding', 'boom', () => {
      throw new Error('kaboom');
    });
    const r = await svc.runAction('branding', 'boom', null);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('kaboom');
  });
});

describe('SettingsService — user-scoped values', () => {
  it('isolates writes by ctx.userId', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest({
      namespace: 'prefs',
      version: 1,
      label: 'Prefs',
      scope: 'user',
      specifiers: [{ type: 'text', key: 'nick', label: 'Nickname', required: false, default: 'anon' }],
    } as any);
    await svc.set('prefs', 'nick', 'alice', { userId: 'u1' });
    await svc.set('prefs', 'nick', 'bob', { userId: 'u2' });
    expect((await svc.get('prefs', 'nick', { userId: 'u1' })).value).toBe('alice');
    expect((await svc.get('prefs', 'nick', { userId: 'u2' })).value).toBe('bob');
    expect((await svc.get('prefs', 'nick', { userId: 'u3' })).value).toBe('anon');
  });
});

describe('SettingsService — Phase 1 change events + client', () => {
  it('fires settings:changed on set with namespace, key, scope, action', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    const events: any[] = [];
    const off = svc.subscribe('mail', (e) => events.push(e));

    await svc.set('mail', 'from_email', 'a@b.c');
    await svc.set('mail', 'from_email', null);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ namespace: 'mail', key: 'from_email', scope: 'global', action: 'set' });
    expect(events[1]).toMatchObject({ namespace: 'mail', key: 'from_email', scope: 'global', action: 'reset' });
    expect(typeof events[0].at).toBe('string');

    off();
    await svc.set('mail', 'from_email', 'x@y.z');
    expect(events).toHaveLength(2);
  });

  it('filters subscribers by namespace', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    svc.registerManifest(brandingSettingsManifest);
    const mailEvents: any[] = [];
    const allEvents: any[] = [];
    svc.subscribe('mail', (e) => mailEvents.push(e));
    svc.subscribe(undefined, (e) => allEvents.push(e));

    await svc.set('mail', 'from_email', 'a@b.c');
    await svc.set('branding', 'workspace_name', 'X');

    expect(mailEvents).toHaveLength(1);
    expect(allEvents).toHaveLength(2);
  });

  it('createClient exposes reactive snapshot that refreshes after set', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    await svc.set('mail', 'from_email', 'initial@x.y');

    const client = await svc.createClient<{ from_email?: string; provider?: string }>('mail');
    expect(client.current.from_email).toBe('initial@x.y');
    expect(client.get('provider')).toBe('smtp');

    await svc.set('mail', 'from_email', 'updated@x.y');
    // Allow microtask drain so the subscriber callback completes.
    await new Promise((r) => setImmediate(r));
    expect(client.current.from_email).toBe('updated@x.y');

    client.dispose();
  });

  it('createClient honours an explicit parser', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    await svc.set('mail', 'smtp_port', 2525);

    const client = await svc.createClient<{ smtp_port: number; provider: string }>('mail', {
      parse: (raw) => ({
        smtp_port: Number(raw.smtp_port ?? 0),
        provider: String(raw.provider ?? 'smtp'),
      }),
    });
    expect(client.current).toEqual({ smtp_port: 2525, provider: 'smtp' });
  });

  it('handler exceptions do not break the writer', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest(mailSettingsManifest);
    svc.subscribe('mail', () => {
      throw new Error('listener boom');
    });
    // Must not throw despite the bad listener.
    await expect(svc.set('mail', 'from_email', 'ok@x.y')).resolves.toBeDefined();
  });
});

describe('SettingsService — Phase 2 cascade chain + lock', () => {
  it('exposes the full cascade chain on ResolvedSettingValue', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest({
      namespace: 'prefs',
      version: 1,
      label: 'Prefs',
      scope: 'user',
      specifiers: [{ type: 'text', key: 'nick', label: 'Nick', required: false, default: 'anon' }],
    } as any);

    // Default only.
    let r = await svc.get<string>('prefs', 'nick', { userId: 'u1' });
    expect(r.value).toBe('anon');
    expect(r.source).toBe('default');
    expect(r.cascadeChain?.map((e) => e.scope)).toEqual(['default']);
    expect(r.cascadeChain?.find((e) => e.effective)?.scope).toBe('default');

    // Add user row → chain has user then default; user wins.
    await svc.set('prefs', 'nick', 'alice', { userId: 'u1' });
    r = await svc.get<string>('prefs', 'nick', { userId: 'u1' });
    expect(r.source).toBe('user');
    expect(r.cascadeChain?.map((e) => e.scope)).toEqual(['user', 'default']);
    expect(r.cascadeChain?.find((e) => e.effective)?.scope).toBe('user');
  });

  it('locked upper-scope row blocks lower-scope writes', async () => {
    const svc = new SettingsService({ env: {} });
    svc.registerManifest({
      namespace: 'feat',
      version: 1,
      label: 'Features',
      scope: 'tenant',
      specifiers: [{ type: 'toggle', key: 'beta', label: 'Beta', required: false, default: false }],
    } as any);

    // Write the global lock directly via the memory store (simulating
    // a platform admin write that the regular API would route to scope='global').
    await (svc as any).upsertRow({
      namespace: 'feat',
      key: 'beta',
      scope: 'global',
      user_id: null,
      value: true,
      value_enc: null,
      encrypted: false,
      locked: true,
      locked_reason: 'Platform policy: beta features disabled in production.',
    });

    // get() reports the lock and the effective value.
    const r = await svc.get<boolean>('feat', 'beta');
    expect(r.value).toBe(true);
    expect(r.source).toBe('global');
    expect(r.locked).toBe(true);
    expect(r.lockedReason).toMatch(/Platform policy/);
    expect(r.cascadeChain?.[0]).toMatchObject({ scope: 'global', locked: true });

    // Tenant-scope set must be rejected with SETTINGS_LOCKED.
    await expect(svc.set('feat', 'beta', false)).rejects.toMatchObject({
      code: 'SETTINGS_LOCKED',
    });
  });
});
