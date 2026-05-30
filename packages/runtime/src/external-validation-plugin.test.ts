// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { ExternalValidationPlugin } from './external-validation-plugin';
import { ExternalSchemaMismatchError, type SchemaDiffEntry } from '@objectstack/spec/shared';

function makeCtx(services: Record<string, unknown>) {
  const warnings: any[] = [];
  const infos: any[] = [];
  const ctx = {
    getService: <T>(name: string): T => {
      if (name in services) return services[name] as T;
      throw new Error(`service '${name}' not registered`);
    },
    registerService: vi.fn(),
    hook: vi.fn(),
    trigger: vi.fn(),
    logger: {
      debug: vi.fn(),
      info: (...a: any[]) => infos.push(a),
      warn: (...a: any[]) => warnings.push(a),
    },
  } as any;
  return { ctx, warnings, infos };
}

const sampleDiffs: SchemaDiffEntry[] = [
  { kind: 'type_mismatch', remoteName: 'fact_orders', column: 'amount', expected: 'number', actual: 'text', severity: 'error' },
];

describe('ExternalValidationPlugin (ADR-0015 Gate 2)', () => {
  it('subscribes to kernel:ready in start()', () => {
    const { ctx } = makeCtx({});
    new ExternalValidationPlugin().start(ctx);
    expect(ctx.hook).toHaveBeenCalledWith('kernel:ready', expect.any(Function));
  });

  it('is a no-op when the external-datasource service is absent', async () => {
    const { ctx } = makeCtx({});
    await expect(new ExternalValidationPlugin().runValidation(ctx)).resolves.toBeUndefined();
  });

  it('passes silently when all federated objects validate', async () => {
    const { ctx, infos } = makeCtx({
      'external-datasource': { validateAll: async () => ({ ok: true, results: [{ ok: true, datasource: 'warehouse', object: 'wh_order', diffs: [] }] }) },
    });
    await new ExternalValidationPlugin().runValidation(ctx);
    expect(infos.length).toBeGreaterThan(0);
  });

  it('throws ExternalSchemaMismatchError on failure with default (fail) policy', async () => {
    const { ctx } = makeCtx({
      'external-datasource': { validateAll: async () => ({ ok: false, results: [{ ok: false, datasource: 'warehouse', object: 'wh_order', diffs: sampleDiffs }] }) },
      metadata: { get: async () => ({ schemaMode: 'external', external: { validation: { onMismatch: 'fail' } } }) },
    });
    await expect(new ExternalValidationPlugin().runValidation(ctx)).rejects.toBeInstanceOf(ExternalSchemaMismatchError);
  });

  it('warns instead of throwing when onMismatch=warn', async () => {
    const { ctx, warnings } = makeCtx({
      'external-datasource': { validateAll: async () => ({ ok: false, results: [{ ok: false, datasource: 'warehouse', object: 'wh_order', diffs: sampleDiffs }] }) },
      metadata: { get: async () => ({ schemaMode: 'validate-only', external: { validation: { onMismatch: 'warn' } } }) },
    });
    await expect(new ExternalValidationPlugin().runValidation(ctx)).resolves.toBeUndefined();
    expect(warnings.some((w) => String(w[0]).includes('drift'))).toBe(true);
  });

  it('does nothing when onMismatch=ignore', async () => {
    const { ctx, warnings } = makeCtx({
      'external-datasource': { validateAll: async () => ({ ok: false, results: [{ ok: false, datasource: 'warehouse', object: 'wh_order', diffs: sampleDiffs }] }) },
      metadata: { get: async () => ({ schemaMode: 'external', external: { validation: { onMismatch: 'ignore' } } }) },
    });
    await expect(new ExternalValidationPlugin().runValidation(ctx)).resolves.toBeUndefined();
    expect(warnings.length).toBe(0);
  });

  it('defaults to fail when the datasource definition is unavailable', async () => {
    const { ctx } = makeCtx({
      'external-datasource': { validateAll: async () => ({ ok: false, results: [{ ok: false, datasource: 'warehouse', object: 'wh_order', diffs: sampleDiffs }] }) },
    });
    await expect(new ExternalValidationPlugin().runValidation(ctx)).rejects.toBeInstanceOf(ExternalSchemaMismatchError);
  });
});
