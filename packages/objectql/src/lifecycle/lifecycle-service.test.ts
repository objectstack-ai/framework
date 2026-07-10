// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { LifecycleService, type LifecycleObjectLike } from './lifecycle-service.js';
import { parseLifecycleDuration } from './duration.js';

const FIXED_NOW = 1_700_000_000_000; // fixed clock for deterministic cutoffs

function silentLogger() {
  return { info: () => {}, warn: () => {}, debug: () => {} };
}

/** Fake engine capturing every bulk delete, with a declarable object set. */
function captureEngine(
  objects: LifecycleObjectLike[],
  opts: {
    deleteImpl?: (object: string, options: any) => any;
    driver?: Record<string, unknown>;
  } = {},
) {
  const deletes: Array<{ object: string; where: any; multi: any; context: any }> = [];
  const engine = {
    registry: { getAllObjects: () => objects },
    async delete(object: string, options: any) {
      deletes.push({ object, where: options?.where, multi: options?.multi, context: options?.context });
      return opts.deleteImpl ? opts.deleteImpl(object, options) : { deletedCount: 3 };
    },
    getDriverForObject: () => opts.driver,
  };
  return { engine, deletes };
}

function service(engine: any, extra: Partial<ConstructorParameters<typeof LifecycleService>[0]> = {}) {
  return new LifecycleService({
    getEngine: () => engine,
    logger: silentLogger(),
    now: () => FIXED_NOW,
    initialDelayMs: 1,
    sweepIntervalMs: 10,
    ...extra,
  });
}

const isoCutoff = (literal: string) => new Date(FIXED_NOW - parseLifecycleDuration(literal)).toISOString();

describe('parseLifecycleDuration', () => {
  it('parses the ADR unit set', () => {
    expect(parseLifecycleDuration('6h')).toBe(6 * 3_600_000);
    expect(parseLifecycleDuration('14d')).toBe(14 * 86_400_000);
    expect(parseLifecycleDuration('2w')).toBe(14 * 86_400_000);
    expect(parseLifecycleDuration('7y')).toBe(7 * 365 * 86_400_000);
  });

  it('throws on malformed literals', () => {
    for (const bad of ['', '14', 'd', '14 days', '2mo', '1.5d']) {
      expect(() => parseLifecycleDuration(bad)).toThrow();
    }
  });
});

describe('LifecycleService.sweep — Reaper', () => {
  it('reaps telemetry by retention.maxAge with an ISO cutoff on created_at, multi + system context', async () => {
    const { engine, deletes } = captureEngine([
      { name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } },
    ]);

    const report = await service(engine).sweep();

    expect(deletes).toHaveLength(1);
    expect(deletes[0].object).toBe('sys_job_run');
    expect(deletes[0].multi).toBe(true);
    expect(deletes[0].context).toEqual({ isSystem: true, positions: [], permissions: [] });
    expect(deletes[0].where).toEqual({ created_at: { $lt: isoCutoff('30d') } });
    // ISO-8601 string, never a bare epoch-ms number (Postgres timestamp columns).
    expect(deletes[0].where.created_at.$lt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(report.swept).toEqual([
      { object: 'sys_job_run', class: 'telemetry', policy: 'retention', cutoff: isoCutoff('30d'), deleted: 3 },
    ]);
    expect(report.errors).toEqual([]);
  });

  it('reaps transient rows by ttl on the declared field', async () => {
    const { engine, deletes } = captureEngine([
      { name: 'sys_device_code', lifecycle: { class: 'transient', ttl: { field: 'expires_at', expireAfter: '1d' } } },
    ]);

    const report = await service(engine).sweep();

    expect(deletes).toHaveLength(1);
    expect(deletes[0].where).toEqual({ expires_at: { $lt: isoCutoff('1d') } });
    expect(report.swept[0].policy).toBe('ttl');
  });

  it('never touches record-class or undeclared objects', async () => {
    const { engine, deletes } = captureEngine([
      { name: 'crm_account' },
      { name: 'crm_invoice', lifecycle: { class: 'record' } },
    ]);

    const report = await service(engine).sweep();

    expect(deletes).toHaveLength(0);
    expect(report.swept).toEqual([]);
  });

  it('skips hot deletion entirely while an archive is declared (retain → archive → delete)', async () => {
    const { engine, deletes } = captureEngine([
      {
        name: 'sys_audit_log',
        lifecycle: {
          class: 'audit',
          retention: { maxAge: '90d' },
          archive: { after: '90d', to: 'archive', keep: '7y' },
        },
      },
    ]);

    const report = await service(engine).sweep();

    // A compliance ledger must never be dropped unarchived: with `archive`
    // declared and no Archiver run, the Reaper must not delete a single row.
    expect(deletes).toHaveLength(0);
    expect(report.skipped).toEqual([{ object: 'sys_audit_log', reason: 'archive-pending' }]);
  });

  it('reaps audit-class rows when only retention is declared (explicit delete-after-window)', async () => {
    const { engine, deletes } = captureEngine([
      { name: 'sys_metadata_audit', lifecycle: { class: 'audit', retention: { maxAge: '365d' } } },
    ]);

    await service(engine).sweep();

    expect(deletes).toHaveLength(1);
    expect(deletes[0].where).toEqual({ created_at: { $lt: isoCutoff('365d') } });
  });

  it('bounds rotation-declared objects by shards × unit until the Rotator shards physically', async () => {
    const { engine, deletes } = captureEngine([
      {
        name: 'sys_activity',
        lifecycle: { class: 'telemetry', storage: { strategy: 'rotation', shards: 14, unit: 'day' } },
      },
    ]);

    const report = await service(engine).sweep();

    expect(deletes).toHaveLength(1);
    expect(deletes[0].where).toEqual({ created_at: { $lt: isoCutoff('14d') } });
    expect(report.swept[0].policy).toBe('rotation-fallback');
  });

  it('rotates physically when the driver supports it — no fallback age reap, reclaim on dropped shards', async () => {
    const rotateShards = vi.fn(async () => ({
      object: 'sys_activity',
      current: 'sys_activity__r20260710',
      shards: ['sys_activity__r20260710'],
      dropped: ['sys_activity__r20260626'],
    }));
    const reclaimSpace = vi.fn(async () => {});
    const driver = { name: 'default', supportsRotation: true, rotateShards, reclaimSpace };
    const obj = {
      name: 'sys_activity',
      lifecycle: { class: 'telemetry' as const, storage: { strategy: 'rotation' as const, shards: 14, unit: 'day' as const } },
    };
    const { engine, deletes } = captureEngine([obj], { driver });

    const report = await service(engine).sweep();

    expect(rotateShards).toHaveBeenCalledWith(obj, FIXED_NOW);
    // Rotation replaces the fallback age reap entirely (no retention declared).
    expect(deletes).toHaveLength(0);
    expect(report.swept).toEqual([
      {
        object: 'sys_activity',
        class: 'telemetry',
        policy: 'rotation',
        cutoff: isoCutoff('14d'),
        droppedShards: 1,
      },
    ]);
    // A dropped shard freed pages — the datasource gets an incremental vacuum.
    expect(reclaimSpace).toHaveBeenCalledTimes(1);
  });

  it('an explicit retention still trims inside the live shards after rotation', async () => {
    const rotateShards = vi.fn(async () => ({
      object: 'sys_activity',
      current: 'sys_activity__r20260710',
      shards: ['sys_activity__r20260710'],
      dropped: [],
    }));
    const driver = { name: 'default', supportsRotation: true, rotateShards };
    const { engine, deletes } = captureEngine(
      [
        {
          name: 'sys_activity',
          lifecycle: {
            class: 'telemetry',
            retention: { maxAge: '14d' },
            storage: { strategy: 'rotation', shards: 14, unit: 'day' },
          },
        },
      ],
      { driver },
    );

    const report = await service(engine).sweep();

    expect(rotateShards).toHaveBeenCalledTimes(1);
    expect(deletes).toHaveLength(1);
    expect(deletes[0].where).toEqual({ created_at: { $lt: isoCutoff('14d') } });
    expect(report.swept.map((e) => e.policy)).toEqual(['rotation', 'retention']);
  });

  it('prefers explicit retention over the rotation fallback window', async () => {
    const { engine, deletes } = captureEngine([
      {
        name: 'sys_activity',
        lifecycle: {
          class: 'telemetry',
          retention: { maxAge: '10d' },
          storage: { strategy: 'rotation', shards: 14, unit: 'day' },
        },
      },
    ]);

    const report = await service(engine).sweep();

    expect(deletes).toHaveLength(1);
    expect(deletes[0].where).toEqual({ created_at: { $lt: isoCutoff('10d') } });
    expect(report.swept[0].policy).toBe('retention');
  });

  it('isolates a failing object — other policies still run, error lands in the report', async () => {
    const { engine, deletes } = captureEngine(
      [
        { name: 'bad_object', lifecycle: { class: 'telemetry', retention: { maxAge: '7d' } } },
        { name: 'good_object', lifecycle: { class: 'telemetry', retention: { maxAge: '7d' } } },
      ],
      {
        deleteImpl: (object) => {
          if (object === 'bad_object') throw new Error('no such table');
          return { deletedCount: 2 };
        },
      },
    );

    const report = await service(engine).sweep();

    expect(deletes.map((d) => d.object)).toEqual(['bad_object', 'good_object']);
    expect(report.errors).toEqual([{ object: 'bad_object', error: 'no such table' }]);
    expect(report.swept.map((e) => e.object)).toEqual(['good_object']);
  });

  it('no-ops without an engine', async () => {
    const svc = new LifecycleService({ getEngine: () => undefined, logger: silentLogger() });
    const report = await svc.sweep();
    expect(report.swept).toEqual([]);
  });

  it('no-ops when disabled via option or OS_LIFECYCLE_DISABLED', async () => {
    const { engine, deletes } = captureEngine([
      { name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } },
    ]);

    const disabled = service(engine, { enabled: false });
    await disabled.sweep();
    expect(deletes).toHaveLength(0);

    process.env.OS_LIFECYCLE_DISABLED = '1';
    try {
      await service(engine).sweep();
      expect(deletes).toHaveLength(0);
    } finally {
      delete process.env.OS_LIFECYCLE_DISABLED;
    }
  });
});

describe('LifecycleService.sweep — space reclaim', () => {
  it('reclaims once per driver after deletions', async () => {
    const reclaimSpace = vi.fn(async () => {});
    const driver = { name: 'default', reclaimSpace };
    const { engine } = captureEngine(
      [
        { name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } },
        { name: 'sys_http_delivery', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } },
      ],
      { driver },
    );

    const report = await service(engine).sweep();

    // Two objects share one datasource — a single incremental_vacuum suffices.
    expect(reclaimSpace).toHaveBeenCalledTimes(1);
    expect(report.reclaimed).toEqual(['default']);
  });

  it('honors reclaim:false and skips reclaim when nothing was deleted', async () => {
    const reclaimSpace = vi.fn(async () => {});
    const driver = { name: 'default', reclaimSpace };

    const optedOut = captureEngine(
      [{ name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' }, reclaim: false } }],
      { driver },
    );
    await service(optedOut.engine).sweep();
    expect(reclaimSpace).not.toHaveBeenCalled();

    const nothingDeleted = captureEngine(
      [{ name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } }],
      { driver, deleteImpl: () => ({ deletedCount: 0 }) },
    );
    await service(nothingDeleted.engine).sweep();
    expect(reclaimSpace).not.toHaveBeenCalled();
  });

  it('a reclaim failure is logged, not thrown', async () => {
    const driver = { name: 'default', reclaimSpace: vi.fn(async () => { throw new Error('locked'); }) };
    const { engine } = captureEngine(
      [{ name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } }],
      { driver },
    );

    const report = await service(engine).sweep();
    expect(report.reclaimed).toEqual([]);
    expect(report.swept).toHaveLength(1);
  });
});

describe('LifecycleService timers', () => {
  it('start() sweeps after the initial delay and then on the interval; stop() disarms', async () => {
    vi.useFakeTimers();
    try {
      const { engine, deletes } = captureEngine([
        { name: 'sys_job_run', lifecycle: { class: 'telemetry', retention: { maxAge: '30d' } } },
      ]);
      const svc = service(engine, { initialDelayMs: 1_000, sweepIntervalMs: 5_000 });

      svc.start();
      expect(deletes).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(deletes).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(deletes).toHaveLength(2);

      svc.stop();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(deletes).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
