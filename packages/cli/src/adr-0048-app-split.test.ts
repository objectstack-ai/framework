// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 — end-to-end verification that the platform apps now live in their
 * own one-app packages and register under DISTINCT package ids.
 *
 * Boots a real ObjectQL engine, runs each app package's plugin `start()` against
 * a manifest service backed by `engine.registerApp` (exactly what the kernel
 * wires — see objectql plugin.ts: `register(m) => ql.registerApp(m)`), and
 * asserts each app resolves under `com.objectstack.{studio,setup,account}` and
 * that all three coexist (the multi-app-package ambiguity is gone).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectQL } from '@objectstack/objectql';
import { createStudioAppPlugin } from '@objectstack/studio';
import { createSetupAppPlugin } from '@objectstack/setup';
import { createAccountAppPlugin } from '@objectstack/account';

function makeCtx(engine: ObjectQL) {
  return {
    getService: (name: string) =>
      name === 'manifest' ? { register: (m: any) => engine.registerApp(m) } : undefined,
    registerService: () => {},
    getServices: () => new Map(),
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    hook: () => {},
  } as any;
}

describe('ADR-0048 — platform apps as one-app packages', () => {
  let engine: ObjectQL;

  beforeEach(async () => {
    engine = new ObjectQL();
    engine.registry.logLevel = 'silent';
    const ctx = makeCtx(engine);
    for (const plugin of [createSetupAppPlugin(), createStudioAppPlugin(), createAccountAppPlugin()]) {
      await plugin.init?.(ctx);
      await plugin.start(ctx);
    }
  });

  it('registers each app under its OWN package id', () => {
    expect(engine.registry.getItem<any>('app', 'studio', 'com.objectstack.studio')?._packageId).toBe(
      'com.objectstack.studio',
    );
    expect(engine.registry.getItem<any>('app', 'setup', 'com.objectstack.setup')?._packageId).toBe(
      'com.objectstack.setup',
    );
    expect(engine.registry.getItem<any>('app', 'account', 'com.objectstack.account')?._packageId).toBe(
      'com.objectstack.account',
    );
  });

  it('all three apps coexist and resolve by name (getApp)', () => {
    expect(engine.registry.getApp('studio')?.name).toBe('studio');
    expect(engine.registry.getApp('setup')?.name).toBe('setup');
    expect(engine.registry.getApp('account')?.name).toBe('account');
  });

  it('each app package owns a distinct namespace (no install-gate conflict)', () => {
    expect(engine.registry.getNamespaceOwners('studio')).toEqual(['com.objectstack.studio']);
    expect(engine.registry.getNamespaceOwners('setup')).toEqual(['com.objectstack.setup']);
    expect(engine.registry.getNamespaceOwners('account')).toEqual(['com.objectstack.account']);
  });

  it('records all three as installed packages', () => {
    const ids = engine.registry.getAllPackages().map((p: any) => p.manifest.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'com.objectstack.studio',
        'com.objectstack.setup',
        'com.objectstack.account',
      ]),
    );
  });
});
