// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { PackageServicePlugin } from './index.js';

/**
 * ADR-0033 package-subsystem consolidation — on boot, the package service
 * reconciles durable `sys_packages` rows back into the in-memory registry so a
 * persisted package (e.g. an AI-authored app package) survives a restart and
 * surfaces in the registry-backed read paths (Studio's selector). It must NOT
 * clobber a package already registered (e.g. from the filesystem).
 */
const SEEDED = { id: 'app.seed', name: 'Seed', version: '1.0.0', type: 'application' };

function sysPackagesRow() {
  return {
    id: SEEDED.id,
    version: SEEDED.version,
    manifest: JSON.stringify(SEEDED),
    metadata: '{}',
    hash: 'h',
    created_at: 't',
    updated_at: 't',
  };
}

function makeCtx(registry: { installPackage: ReturnType<typeof vi.fn>; getPackage: ReturnType<typeof vi.fn> }) {
  const execute = vi.fn(async ({ sql }: { sql: string }) => {
    // The latest-per-id list query backs packageService.list() used by hydration.
    if (/SELECT \* FROM sys_packages/i.test(sql)) return { rows: [sysPackagesRow()] };
    return { rows: [] }; // CREATE TABLE / INDEX / others
  });
  const engine = { execute, registry } as never;
  const services = new Map<string, unknown>([['objectql', engine]]);
  const ctx = {
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    getService: (n: string) => services.get(n),
    registerService: (n: string, s: unknown) => services.set(n, s),
  } as never;
  return { ctx, execute };
}

describe('PackageServicePlugin boot hydration (ADR-0033 consolidation)', () => {
  it('hydrates a persisted sys_packages row into the registry when absent', async () => {
    const registry = {
      installPackage: vi.fn(),
      getPackage: vi.fn(() => undefined), // not yet in registry
    };
    const { ctx } = makeCtx(registry);

    await new PackageServicePlugin().start(ctx);

    expect(registry.getPackage).toHaveBeenCalledWith('app.seed');
    expect(registry.installPackage).toHaveBeenCalledTimes(1);
    expect(registry.installPackage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'app.seed', version: '1.0.0' }),
    );
  });

  it('does NOT overwrite a package already registered (e.g. from the filesystem)', async () => {
    const registry = {
      installPackage: vi.fn(),
      getPackage: vi.fn(() => ({ manifest: SEEDED, status: 'installed' })), // already present
    };
    const { ctx } = makeCtx(registry);

    await new PackageServicePlugin().start(ctx);

    expect(registry.getPackage).toHaveBeenCalledWith('app.seed');
    expect(registry.installPackage).not.toHaveBeenCalled();
  });
});
