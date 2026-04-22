// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { createSystemProjectPlugin, SYSTEM_PROJECT_ID } from './system-project-plugin.js';

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

describe('createSystemProjectPlugin', () => {
  it('returns a plugin with name and version', () => {
    const plugin = createSystemProjectPlugin();
    expect(plugin.name).toBe('com.objectstack.runtime.system-project');
    expect(plugin.version).toBe('1.0.0');
  });

  it('no-ops when provisioning service is absent (default: strict=false)', async () => {
    const plugin = createSystemProjectPlugin();
    const ctx = makeCtx({});
    await expect(plugin.start!(ctx as any)).resolves.toBeUndefined();
    expect(ctx.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('unavailable'),
    );
  });

  it('throws when strict=true and provisioning service is absent', async () => {
    const plugin = createSystemProjectPlugin({ strict: true });
    const ctx = makeCtx({});
    await expect(plugin.start!(ctx as any)).rejects.toThrow(/cannot bootstrap system project/);
  });

  it('invokes provisionSystemProject and logs the returned id', async () => {
    const provisionSystemProject = vi.fn().mockResolvedValue({
      project: { id: SYSTEM_PROJECT_ID, isSystem: true },
      warnings: [],
    });
    const ctx = makeCtx({
      'tenant.provisioning': { provisionSystemProject },
    });
    const plugin = createSystemProjectPlugin();
    await plugin.start!(ctx as any);

    expect(provisionSystemProject).toHaveBeenCalledOnce();
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('System project ready'),
      expect.objectContaining({ projectId: SYSTEM_PROJECT_ID, isSystem: true }),
    );
  });

  it('resolves an alternate service name when configured', async () => {
    const provisionSystemProject = vi.fn().mockResolvedValue({
      project: { id: SYSTEM_PROJECT_ID },
    });
    const ctx = makeCtx({
      'custom.provisioning': { provisionSystemProject },
    });

    const plugin = createSystemProjectPlugin({ serviceName: 'custom.provisioning' });
    await plugin.start!(ctx as any);
    expect(provisionSystemProject).toHaveBeenCalled();
  });

  it('swallows provisioning errors when strict=false', async () => {
    const provisionSystemProject = vi.fn().mockRejectedValue(new Error('control plane down'));
    const ctx = makeCtx({
      'tenant.provisioning': { provisionSystemProject },
    });
    const plugin = createSystemProjectPlugin();
    await expect(plugin.start!(ctx as any)).resolves.toBeUndefined();
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to provision system project'),
      expect.objectContaining({ error: 'control plane down' }),
    );
  });

  it('re-throws provisioning errors when strict=true', async () => {
    const provisionSystemProject = vi.fn().mockRejectedValue(new Error('boom'));
    const ctx = makeCtx({
      'tenant.provisioning': { provisionSystemProject },
    });
    const plugin = createSystemProjectPlugin({ strict: true });
    await expect(plugin.start!(ctx as any)).rejects.toThrow('boom');
  });
});
