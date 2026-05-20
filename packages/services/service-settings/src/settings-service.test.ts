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
    expect(ns.values.api_key.source).toBe('tenant');
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
