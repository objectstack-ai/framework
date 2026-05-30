// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import type { IDatasourceAdminService, IDatasourceDriverFactory } from '@objectstack/spec/contracts';
import {
  DatasourceAdminServicePlugin,
  type DatasourceAdminServicePluginOptions,
} from '../datasource-admin-plugin.js';

/**
 * Minimal PluginContext + in-memory metadata service. Boots the plugin and
 * returns the registered `datasource-admin` service so we can exercise the
 * plugin's glue (probe via factory, fail-closed secret) end to end.
 */
async function boot(opts: DatasourceAdminServicePluginOptions & {
  services?: Record<string, unknown>;
} = {}) {
  const registry = new Map<string, Map<string, unknown>>();
  const metadata = {
    get: async (t: string, n: string) => registry.get(t)?.get(n),
    list: async (t: string) => [...(registry.get(t)?.values() ?? [])],
    register: async (t: string, n: string, d: unknown) => {
      if (!registry.has(t)) registry.set(t, new Map());
      registry.get(t)!.set(n, d);
    },
    unregister: async (t: string, n: string) => {
      registry.get(t)?.delete(n);
    },
    listObjects: async () => [...(registry.get('object')?.values() ?? [])],
  };

  const services: Record<string, unknown> = { metadata, ...(opts.services ?? {}) };
  let registered: IDatasourceAdminService | undefined;
  const ctx: any = {
    getService: (name: string) => {
      if (name in services) return services[name];
      throw new Error(`no service ${name}`);
    },
    registerService: (name: string, svc: unknown) => {
      if (name === 'datasource-admin') registered = svc as IDatasourceAdminService;
    },
    trigger: async () => {},
    logger: { warn() {}, info() {} },
  };

  const { services: _omit, ...pluginOpts } = opts;
  const plugin = new DatasourceAdminServicePlugin(pluginOpts);
  await plugin.init(ctx);
  return { service: registered!, registry, metadata };
}

/** A driver factory whose handle records connect/ping/disconnect calls. */
function fakeFactory(over?: Partial<IDatasourceDriverFactory> & { onProbe?: () => void }): IDatasourceDriverFactory {
  return {
    supports: (id: string) => id === 'postgres',
    create: async (spec) => ({
      connect: async () => {},
      ping: async () => {
        over?.onProbe?.();
        // expose the secret the factory received for assertions
        (globalThis as any).__lastProbeSecret = spec.secret;
      },
      disconnect: async () => {},
      serverVersion: async () => 'PostgreSQL 16.1',
    }),
    ...over,
  };
}

describe('DatasourceAdminServicePlugin: probe', () => {
  it('tests a connection through the driver factory (latency + version)', async () => {
    const { service } = await boot({
      driverFactory: fakeFactory(),
    });
    const res = await service.testConnection(
      { name: 'reporting', driver: 'postgres', config: { host: 'db' } },
      { value: 's3cret' },
    );
    expect(res.ok).toBe(true);
    expect(res.serverVersion).toBe('PostgreSQL 16.1');
    expect(typeof res.latencyMs).toBe('number');
    expect((globalThis as any).__lastProbeSecret).toBe('s3cret');
  });

  it('returns ok:false when no factory supports the driver', async () => {
    const { service } = await boot({ driverFactory: fakeFactory() });
    const res = await service.testConnection({ name: 'x', driver: 'oracle', config: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no driver factory supports/i);
  });

  it('returns ok:false when no factory is registered at all', async () => {
    const { service } = await boot();
    const res = await service.testConnection({ name: 'x', driver: 'postgres', config: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no driver factory is registered/i);
  });
});

describe('DatasourceAdminServicePlugin: secret fail-closed', () => {
  it('refuses to create a secret-bearing datasource without a secret binder', async () => {
    const { service, registry } = await boot({ driverFactory: fakeFactory() });
    await expect(
      service.createDatasource({ name: 'reporting', driver: 'postgres', config: {} }, { value: 'pw' }),
    ).rejects.toThrow(/no secret store configured/i);
    // nothing persisted
    expect(registry.get('datasource')?.size ?? 0).toBe(0);
  });

  it('persists a credentialsRef (not cleartext) when a binder is wired', async () => {
    const bound: string[] = [];
    const { service, registry } = await boot({
      driverFactory: fakeFactory(),
      secrets: {
        bind: async (input, hint) => {
          bound.push(input.value);
          return `sys_secret://datasource/${hint.name}#1`;
        },
      },
    });
    await service.createDatasource({ name: 'reporting', driver: 'postgres', config: {} }, { value: 'pw' });
    const rec = registry.get('datasource')?.get('reporting') as any;
    expect(rec.origin).toBe('runtime');
    expect(rec.external?.credentialsRef).toBe('sys_secret://datasource/reporting#1');
    expect(JSON.stringify(rec)).not.toContain('pw');
    expect(bound).toEqual(['pw']);
  });
});

describe('DatasourceAdminServicePlugin: persistence + bound count', () => {
  it('lists code (artefact) + runtime records with origin, blocks remove while bound', async () => {
    const { service, registry } = await boot({ driverFactory: fakeFactory() });
    // seed an artefact (code) datasource lacking explicit origin
    registry.set('datasource', new Map([['crm_primary', { name: 'crm_primary', driver: 'sqlite' }]]));
    // seed an object bound to a runtime datasource
    registry.set('object', new Map([['lead', { name: 'lead', datasource: 'reporting' }]]));

    await service.createDatasource({ name: 'reporting', driver: 'postgres', config: {} });

    const list = await service.listDatasources();
    expect(list.find((d) => d.name === 'crm_primary')?.origin).toBe('code');
    expect(list.find((d) => d.name === 'reporting')?.origin).toBe('runtime');

    await expect(service.removeDatasource('reporting')).rejects.toThrow(/1 object\(s\)/);
  });
});
