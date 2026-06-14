// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { JobRunRetention, DEFAULT_JOB_RUN_RETENTION_DAYS } from './job-run-retention';

const DAY = 86_400_000;

/** Minimal engine supporting the `delete … where created_at < cutoff` shape. */
function makeFakeEngine() {
  const rows: Array<{ id: string; created_at: string }> = [];
  let deleteCalls = 0;
  return {
    rows,
    get deleteCalls() {
      return deleteCalls;
    },
    seed(...createdAts: string[]) {
      createdAts.forEach((created_at, i) => rows.push({ id: `run_${i}`, created_at }));
    },
    async find() {
      return [...rows];
    },
    async insert() {
      return {};
    },
    async update() {
      return {};
    },
    async delete(_table: string, opts: any) {
      deleteCalls++;
      const cutoff = opts?.where?.created_at?.$lt as string | undefined;
      if (cutoff === undefined) return 0;
      let deleted = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].created_at < cutoff) {
          rows.splice(i, 1);
          deleted++;
        }
      }
      return deleted;
    },
  };
}

const silentLogger = { info() {}, warn() {} };

describe('JobRunRetention', () => {
  it('prunes only rows older than the retention window', async () => {
    const engine = makeFakeEngine();
    const nowMs = Date.parse('2026-06-14T00:00:00.000Z');
    // 3 old (>30d), 2 recent (<30d)
    engine.seed(
      new Date(nowMs - 100 * DAY).toISOString(),
      new Date(nowMs - 60 * DAY).toISOString(),
      new Date(nowMs - 31 * DAY).toISOString(),
      new Date(nowMs - 10 * DAY).toISOString(),
      new Date(nowMs - 1 * DAY).toISOString(),
    );

    const retention = new JobRunRetention({
      getEngine: () => engine as any,
      logger: silentLogger,
      now: () => nowMs,
    });

    const outcome = await retention.prune(30);
    expect(outcome.deleted).toBe(3);
    expect(outcome.error).toBeUndefined();
    expect(engine.rows).toHaveLength(2);
  });

  it('is a no-op when retentionDays is not positive', async () => {
    const engine = makeFakeEngine();
    engine.seed(new Date(0).toISOString());
    const retention = new JobRunRetention({ getEngine: () => engine as any, logger: silentLogger });

    const outcome = await retention.prune(0);
    expect(outcome.deleted).toBe(0);
    expect(engine.deleteCalls).toBe(0);
    expect(engine.rows).toHaveLength(1);
  });

  it('is a no-op when no data engine is available', async () => {
    const retention = new JobRunRetention({ getEngine: () => undefined, logger: silentLogger });
    const outcome = await retention.prune(30);
    expect(outcome.deleted).toBe(0);
  });

  it('reports an error (without throwing) when the engine delete fails', async () => {
    const retention = new JobRunRetention({
      getEngine: () =>
        ({
          delete() {
            throw new Error('db down');
          },
        }) as any,
      logger: silentLogger,
    });
    const outcome = await retention.prune(30);
    expect(outcome.error).toMatch(/db down/);
    expect(outcome.deleted).toBeUndefined();
  });

  it('exposes a sane positive default retention window', () => {
    expect(DEFAULT_JOB_RUN_RETENTION_DAYS).toBeGreaterThan(0);
    expect(Number.isFinite(DEFAULT_JOB_RUN_RETENTION_DAYS)).toBe(true);
  });
});
