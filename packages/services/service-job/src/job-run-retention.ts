// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { JobEngineLike, JobLoggerLike } from './db-job-adapter.js';

const RUN_TABLE = 'sys_job_run';
const SYSTEM_CTX = { isSystem: true, positions: [], permissions: [] } as const;

/**
 * Default retention window for `sys_job_run` rows, in days. Every job execution
 * appends a run row (see {@link DbJobAdapter}); without pruning the table grows
 * unbounded on a long-running deployment (launch-readiness.md P1-2). 30 days
 * keeps recent history for operational triage while bounding growth. Operators
 * raise/lower it via `JobServicePlugin` options; `0` disables retention.
 */
export const DEFAULT_JOB_RUN_RETENTION_DAYS = 30;

/**
 * Default interval between retention sweeps. Job-run volume is far lower than the
 * notification pipeline's, so a 6-hour cadence is ample — the sweep is a single
 * bulk `delete … where created_at < cutoff`.
 */
export const DEFAULT_JOB_RUN_SWEEP_MS = 6 * 3_600_000;

export interface JobRunRetentionOptions {
  /** Resolve the data engine; `undefined` ⇒ prune is a no-op. */
  getEngine(): JobEngineLike | undefined;
  logger: JobLoggerLike;
  /** Override the swept object (tests). Defaults to `sys_job_run`. */
  object?: string;
  /** Timestamp field used for the cutoff (ISO-8601). Defaults to `created_at`. */
  tsField?: string;
  /** Clock injection for deterministic tests. Defaults to `Date.now()`. */
  now?(): number;
}

export interface JobRunPruneOutcome {
  object: string;
  /** `undefined` when the driver doesn't report a count. */
  deleted?: number;
  error?: string;
}

/**
 * Retention sweeper for `sys_job_run` (launch-readiness.md P1-2).
 *
 * Mirrors the proven `NotificationRetention` shape in `service-messaging`:
 * a single bulk delete of rows older than a cutoff, under a system context
 * (retention is a cross-tenant operator policy). Isolated from job execution —
 * a sweep failure is logged and never throws into the scheduler.
 *
 * Unlike the messaging sweeper, this one is **default-on** in the plugin: an
 * append-only run log with no ceiling is a guaranteed slow leak, so GA ships
 * with a sensible window rather than requiring opt-in.
 */
export class JobRunRetention {
  private readonly now: () => number;
  private readonly object: string;
  private readonly tsField: string;

  constructor(private readonly opts: JobRunRetentionOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.object = opts.object ?? RUN_TABLE;
    this.tsField = opts.tsField ?? 'created_at';
  }

  /**
   * Delete `sys_job_run` rows older than `retentionDays`. No-op when no data
   * engine is available, the engine can't delete, or `retentionDays` is not a
   * positive number.
   */
  async prune(retentionDays: number): Promise<JobRunPruneOutcome> {
    const engine = this.opts.getEngine();
    if (!engine || typeof engine.delete !== 'function') {
      this.opts.logger.warn('[job] retention: no deletable data engine; prune skipped');
      return { object: this.object, deleted: 0 };
    }
    if (!(retentionDays > 0)) {
      this.opts.logger.warn(`[job] retention: invalid retentionDays=${retentionDays}; prune skipped`);
      return { object: this.object, deleted: 0 };
    }

    const cutoffIso = new Date(this.now() - retentionDays * 86_400_000).toISOString();
    try {
      const res = await engine.delete(this.object, {
        where: { [this.tsField]: { $lt: cutoffIso } },
        multi: true,
        context: SYSTEM_CTX,
      });
      const deleted = countDeleted(res);
      if (deleted === undefined || deleted > 0) {
        this.opts.logger.info(
          `[job] retention: pruned ${deleted ?? '?'} ${this.object} rows older than ${cutoffIso}`,
        );
      }
      return { object: this.object, deleted };
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      this.opts.logger.warn(`[job] retention: prune of ${this.object} failed (${msg})`);
      return { object: this.object, error: msg };
    }
  }
}

/** Best-effort row-count extraction from a driver's delete result. */
function countDeleted(res: unknown): number | undefined {
  if (typeof res === 'number') return res;
  if (Array.isArray(res)) return res.length;
  if (res && typeof res === 'object') {
    const r = res as Record<string, unknown>;
    for (const k of ['deletedCount', 'deleted', 'count', 'affected', 'affectedRows']) {
      if (typeof r[k] === 'number') return r[k] as number;
    }
  }
  return undefined;
}
