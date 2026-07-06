// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0048 — end-to-end verification that the platform apps now live in their
 * own one-app packages and register under DISTINCT package ids.
 *
 * Boots a real ObjectQL engine, runs each app package's plugin `start()` against
 * a manifest service backed by `engine.registerApp` (exactly what the kernel
 * wires — see objectql plugin.ts: `register(m) => ql.registerApp(m)`), and
 * asserts each app resolves under `com.objectstack.{setup,account}` and that
 * they coexist (the multi-app-package ambiguity is gone).
 *
 * Studio is one of the same one-app packages but is no longer default-loaded
 * (it now lives in the console at `/_console/studio/...`), so cli/plugin-dev no
 * longer depend on `@objectstack/studio`. Setup + Account exercise the identical
 * app-split code path; asserting them keeps this regression intact without cli
 * re-taking a dependency purely for the test.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectQL } from '@objectstack/objectql';
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
    for (const plugin of [createSetupAppPlugin(), createAccountAppPlugin()]) {
      await plugin.init?.(ctx);
      await plugin.start(ctx);
    }
  });

  it('registers each app under its OWN package id', () => {
    expect(engine.registry.getItem<any>('app', 'setup', 'com.objectstack.setup')?._packageId).toBe(
      'com.objectstack.setup',
    );
    expect(engine.registry.getItem<any>('app', 'account', 'com.objectstack.account')?._packageId).toBe(
      'com.objectstack.account',
    );
  });

  it('the apps coexist and resolve by name (getApp)', () => {
    expect(engine.registry.getApp('setup')?.name).toBe('setup');
    expect(engine.registry.getApp('account')?.name).toBe('account');
  });

  it('each app package owns a distinct namespace (no install-gate conflict)', () => {
    expect(engine.registry.getNamespaceOwners('setup')).toEqual(['com.objectstack.setup']);
    expect(engine.registry.getNamespaceOwners('account')).toEqual(['com.objectstack.account']);
  });

  it('records the app packages as installed', () => {
    const ids = engine.registry.getAllPackages().map((p: any) => p.manifest.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'com.objectstack.setup',
        'com.objectstack.account',
      ]),
    );
  });
});
