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
  list?: (type: string) => Promise<unknown[]>;
}

interface DatasourceDef {
  name?: string;
  schemaMode?: string;
  external?: {
    validation?: {
      onMismatch?: 'fail' | 'warn' | 'ignore';
      checkIntervalMs?: number;
    };
  };
}

/**
 * Payload of the `external.schema.drift` event emitted on the kernel bus by the
 * background drift checker (ADR-0015 §5.2). Consumed by `audit` / `notification`
 * services. One event per drifted federated object.
 */
export interface ExternalSchemaDriftEvent {
  datasource: string;
  object: string;
  diffs: SchemaDiffEntry[];
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

  /** Active background drift-check timers, keyed by datasource name. */
  private driftTimers = new Map<string, ReturnType<typeof setInterval>>();

  init = (_ctx: PluginContext): void => {
    // Nothing to register; validation runs on kernel:ready (see start()).
  };

  start = (ctx: PluginContext): void => {
    // Subscribe to kernel-ready so validation runs after every plugin (drivers,
    // services, manifests) has been registered.
    ctx.hook('kernel:ready', async () => {
      await this.runValidation(ctx);
      // Boot validation done; arm any background drift checks (ADR-0015 §5.2).
      await this.scheduleDriftChecks(ctx);
    });
  };

  /** Tear down background drift-check timers (idempotent). */
  stop = (): void => {
    for (const timer of this.driftTimers.values()) clearInterval(timer);
    this.driftTimers.clear();
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

  /**
   * Arm a background drift checker for every federated datasource that declares
   * `external.validation.checkIntervalMs`. Each fires on its own interval and
   * emits `external.schema.drift` events — it never throws or aborts the
   * process, since drift past boot is observational, not fatal.
   *
   * No-op when metadata can't be enumerated or no datasource opts in. Re-arming
   * (e.g. a second `kernel:ready`) first clears existing timers so intervals
   * don't accumulate.
   */
  async scheduleDriftChecks(ctx: PluginContext): Promise<void> {
    this.stop();
    const metadata = safeGet<MetadataServiceLike>(ctx, 'metadata');
    if (!metadata?.list) return;

    let datasources: unknown[];
    try {
      datasources = await metadata.list('datasource');
    } catch (err) {
      ctx.logger?.warn?.('[external-validation] could not list datasources for drift checks', { err });
      return;
    }

    for (const def of datasources as DatasourceDef[]) {
      const interval = def?.external?.validation?.checkIntervalMs;
      const name = def?.name;
      if (!name || typeof interval !== 'number' || interval <= 0) continue;

      const timer = setInterval(() => {
        // Fire-and-forget: the checker swallows its own errors.
        void this.runDriftCheck(ctx, name);
      }, interval);
      // Don't let the drift timer keep the process alive on its own.
      (timer as { unref?: () => void }).unref?.();
      this.driftTimers.set(name, timer);
      ctx.logger?.info?.('[external-validation] armed background drift check', {
        datasource: name,
        intervalMs: interval,
      });
    }
  }

  /**
   * Re-validate one datasource's federated objects and emit an
   * `external.schema.drift` event per mismatch. Exposed for testing; invoked
   * from the interval armed by {@link scheduleDriftChecks}. Never throws.
   *
   * @returns the number of drift events emitted.
   */
  async runDriftCheck(ctx: PluginContext, datasource: string): Promise<number> {
    const svc = safeGet<ExternalDatasourceServiceLike>(ctx, 'external-datasource');
    if (!svc?.validateAll) return 0;

    let report: Awaited<ReturnType<ExternalDatasourceServiceLike['validateAll']>>;
    try {
      report = await svc.validateAll();
    } catch (err) {
      ctx.logger?.warn?.('[external-validation] drift check validateAll failed', {
        datasource,
        err,
      });
      return 0;
    }

    const drifted = report.results.filter((r) => !r.ok && r.datasource === datasource);
    for (const r of drifted) {
      const event: ExternalSchemaDriftEvent = {
        datasource: r.datasource,
        object: r.object,
        diffs: r.diffs,
      };
      try {
        await ctx.trigger('external.schema.drift', event);
      } catch (err) {
        ctx.logger?.warn?.('[external-validation] failed to emit drift event', {
          datasource,
          object: r.object,
          err,
        });
      }
    }
    if (drifted.length > 0) {
      ctx.logger?.warn?.('[external-validation] background drift detected', {
        datasource,
        objects: drifted.map((r) => r.object),
      });
    }
    return drifted.length;
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
