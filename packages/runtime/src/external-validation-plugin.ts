// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Plugin, PluginContext } from '@objectstack/core';
import {
  ExternalSchemaMismatchError,
  type SchemaDiffEntry,
} from '@objectstack/spec/shared';

/**
 * Structural subset of `IExternalDatasourceService` used here, to avoid a hard
 * dependency on the service package from runtime.
 */
interface ExternalDatasourceServiceLike {
  validateAll(): Promise<{
    ok: boolean;
    results: Array<{ ok: boolean; datasource: string; object: string; diffs: SchemaDiffEntry[] }>;
  }>;
}

interface MetadataServiceLike {
  get?: (type: string, name: string) => Promise<unknown>;
}

interface DatasourceDef {
  schemaMode?: string;
  external?: { validation?: { onMismatch?: 'fail' | 'warn' | 'ignore' } };
}

/**
 * Boot-validation plugin — Gate 2 of ADR-0015 §5.2.
 *
 * On `kernel:ready`, validates every federated object against its remote table
 * (via the `external-datasource` service) and applies the datasource's
 * `external.validation.onMismatch` policy:
 *   - `fail`   → throws `ExternalSchemaMismatchError` (aborts boot) — default,
 *   - `warn`   → logs the diff and continues,
 *   - `ignore` → does nothing.
 *
 * No-op when the `external-datasource` service is not registered (federation
 * unused).
 */
export class ExternalValidationPlugin implements Plugin {
  name = 'com.objectstack.external-validation';
  type = 'standard';
  version = '1.0.0';

  init = (_ctx: PluginContext): void => {
    // Nothing to register; validation runs on kernel:ready (see start()).
  };

  start = (ctx: PluginContext): void => {
    // Subscribe to kernel-ready so validation runs after every plugin (drivers,
    // services, manifests) has been registered.
    ctx.hook('kernel:ready', async () => {
      await this.runValidation(ctx);
    });
  };

  /** Exposed for testing; invoked from the kernel:ready handler. */
  async runValidation(ctx: PluginContext): Promise<void> {
    const svc = safeGet<ExternalDatasourceServiceLike>(ctx, 'external-datasource');
    if (!svc?.validateAll) {
      ctx.logger?.debug?.('[external-validation] service not registered; skipping');
      return;
    }

    const metadata = safeGet<MetadataServiceLike>(ctx, 'metadata');
    let report: Awaited<ReturnType<ExternalDatasourceServiceLike['validateAll']>>;
    try {
      report = await svc.validateAll();
    } catch (err) {
      ctx.logger?.warn?.('[external-validation] validateAll failed', { err });
      return;
    }

    const failures = report.results.filter((r) => !r.ok);
    if (failures.length === 0) {
      ctx.logger?.info?.('[external-validation] all federated objects match their remote schema', {
        objects: report.results.length,
      });
      return;
    }

    for (const r of failures) {
      const mode = await resolveOnMismatch(metadata, r.datasource);
      if (mode === 'ignore') continue;
      if (mode === 'warn') {
        ctx.logger?.warn?.('[external-validation] external schema drift', {
          datasource: r.datasource,
          object: r.object,
          diffs: r.diffs,
        });
        continue;
      }
      // mode === 'fail' (default)
      throw new ExternalSchemaMismatchError(r.datasource, r.object, r.diffs);
    }
  }
}

/** Convenience factory mirroring the createXxxPlugin convention. */
export function createExternalValidationPlugin(): ExternalValidationPlugin {
  return new ExternalValidationPlugin();
}

async function resolveOnMismatch(
  metadata: MetadataServiceLike | undefined,
  datasource: string,
): Promise<'fail' | 'warn' | 'ignore'> {
  try {
    const ds = (await metadata?.get?.('datasource', datasource)) as DatasourceDef | undefined;
    return ds?.external?.validation?.onMismatch ?? 'fail';
  } catch {
    return 'fail';
  }
}

function safeGet<T>(ctx: PluginContext, name: string): T | undefined {
  try {
    return ctx.getService<T>(name);
  } catch {
    return undefined;
  }
}
