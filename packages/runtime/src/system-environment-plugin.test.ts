// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { createSystemEnvironmentPlugin, SYSTEM_ENVIRONMENT_ID } from './system-environment-plugin.js';

function makeCtx(services: Record<string, any> = {}) {
  return {
    registerService: vi.fn(),
    getService: vi.fn((name: string) => {
      if (services[name]) return services[name];
      throw new Error(`Service '${name}' not found`);
    }),
    getServices: vi.fn(() => new Map(Object.entries(services))),
    hook: vi.fn(),
    trigger: vi.fn().mockResolvedValue(undefined),
    getKernel: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe('createSystemEnvironmentPlugin', () => {
  it('returns a plugin with name and version', () => {
    const plugin = createSystemEnvironmentPlugin();
    expect(plugin.name).toBe('com.objectstack.runtime.system-environment');
    expect(plugin.version).toBe('1.0.0');
  });

  it('no-ops when provisioning service is absent (default: strict=false)', async () => {
    const plugin = createSystemEnvironmentPlugin();
    const ctx = makeCtx({});
    await expect(plugin.start!(ctx as any)).resolves.toBeUndefined();
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('unavailable'),
    );
  });

  it('throws when strict=true and provisioning service is absent', async () => {
    const plugin = createSystemEnvironmentPlugin({ strict: true });
    const ctx = makeCtx({});
    await expect(plugin.start!(ctx as any)).rejects.toThrow(/cannot bootstrap system project/);
  });

  it('invokes provisionSystemEnvironment and logs the returned id', async () => {
    const provisionSystemEnvironment = vi.fn().mockResolvedValue({
      project: { id: SYSTEM_ENVIRONMENT_ID, isSystem: true },
      warnings: [],
    });
    const ctx = makeCtx({
      'tenant.provisioning': { provisionSystemEnvironment },
    });
    const plugin = createSystemEnvironmentPlugin();
    await plugin.start!(ctx as any);

    expect(provisionSystemEnvironment).toHaveBeenCalledOnce();
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('System project ready'),
      expect.objectContaining({ environmentId: SYSTEM_ENVIRONMENT_ID, isSystem: true }),
    );
  });

  it('resolves an alternate service name when configured', async () => {
    const provisionSystemEnvironment = vi.fn().mockResolvedValue({
      project: { id: SYSTEM_ENVIRONMENT_ID },
    });
    const ctx = makeCtx({
      'custom.provisioning': { provisionSystemEnvironment },
    });

    const plugin = createSystemEnvironmentPlugin({ serviceName: 'custom.provisioning' });
    await plugin.start!(ctx as any);
    expect(provisionSystemEnvironment).toHaveBeenCalled();
  });

  it('swallows provisioning errors when strict=false', async () => {
    const provisionSystemEnvironment = vi.fn().mockRejectedValue(new Error('control plane down'));
    const ctx = makeCtx({
      'tenant.provisioning': { provisionSystemEnvironment },
    });
    const plugin = createSystemEnvironmentPlugin();
    await expect(plugin.start!(ctx as any)).resolves.toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to provision system project'),
      expect.objectContaining({ error: 'control plane down' }),
    );
  });

  it('re-throws provisioning errors when strict=true', async () => {
    const provisionSystemEnvironment = vi.fn().mockRejectedValue(new Error('boom'));
    const ctx = makeCtx({
      'tenant.provisioning': { provisionSystemEnvironment },
    });
    const plugin = createSystemEnvironmentPlugin({ strict: true });
    await expect(plugin.start!(ctx as any)).rejects.toThrow('boom');
  });
});
