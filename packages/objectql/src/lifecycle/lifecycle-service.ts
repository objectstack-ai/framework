// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { Lifecycle } from '@objectstack/spec/data';
import { parseLifecycleDuration } from './duration.js';

/**
 * LifecycleService — the single platform-owned enforcer of ADR-0057
 * `lifecycle` declarations. Scans every registered object carrying a
 * `lifecycle` block and applies its policy:
 *
 *   - **Reaper** (P1): batch-deletes rows past `retention.maxAge` (by
 *     `created_at`) or past `ttl.field + ttl.expireAfter`, then asks each
 *     touched driver to reclaim free space (SQLite `incremental_vacuum`).
 *   - **Rotator** (P2): time-shards high-frequency telemetry and DROPs the
 *     oldest shard. Until a driver advertises rotation support, declared
 *     rotation falls back to an age-based reap bounded by `shards × unit`.
 *   - **Archiver** (P3): copies audit-class cold rows to the declared archive
 *     datasource, then deletes them from the hot store. **Safety rule:** an
 *     object that declares `archive` is never hot-deleted unless the archive
 *     copy succeeded — a compliance ledger must not be dropped unarchived.
 *
 * Design constraints (ADR-0057 §3.3):
 *   - One implementation, owned here — not N per-plugin sweepers.
 *   - Sweeps run under a system context (cross-tenant operator policy) and
 *     use bulk `multi: true` deletes, so at most ONE afterDelete hook fires
 *     per object per sweep — audit sees an aggregate, never per-row noise
 *     (telemetry-class sys_* objects are additionally in the audit writer's
 *     SKIP_OBJECTS, so they produce no audit rows at all).
 *   - A sweep failure is logged and isolated; it never throws into the
 *     scheduler and never blocks other objects' policies.
 */

/** Cross-tenant operator context — lifecycle is a system policy, not a user
 * action (mirrors the existing retention sweepers). */
const SYSTEM_CTX: LifecycleSweepContext = { isSystem: true, positions: [], permissions: [] };

export interface LifecycleSweepContext {
  isSystem: boolean;
  positions: string[];
  permissions: string[];
}

/** Width of one rotation shard. Months are the operational 30d, matching the
 * coarse-bound posture of {@link parseLifecycleDuration}. */
const SHARD_UNIT_MS: Record<'day' | 'week' | 'month', number> = {
  day: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

/** Default cadence between sweeps. Lifecycle windows are hours-to-years, so
 * hourly enforcement is ample and keeps the sweep invisible in profiles. */
export const DEFAULT_LIFECYCLE_SWEEP_MS = 3_600_000;

/** Delay before the first sweep after boot — lets seeding/migrations finish
 * and keeps short-lived test kernels from ever sweeping. */
export const DEFAULT_LIFECYCLE_INITIAL_DELAY_MS = 60_000;

/** Minimal engine surface the service needs — duck-typed for tests. */
export interface LifecycleEngineLike {
  registry: { getAllObjects(): LifecycleObjectLike[] };
  delete(
    object: string,
    options: { where: Record<string, unknown>; multi: true; context: LifecycleSweepContext },
  ): Promise<unknown>;
  getDriverForObject(objectName: string): unknown;
  /** Datasource lookup by name; throws/absent when not registered. */
  datasource?(name: string): unknown;
}

export interface LifecycleObjectLike {
  name: string;
  lifecycle?: Lifecycle;
  fields?: Record<string, unknown>;
}

export interface LifecycleLoggerLike {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  debug?(msg: string, meta?: unknown): void;
}

export interface LifecycleServiceOptions {
  /** Resolve the data engine; `undefined` ⇒ sweep is a no-op. */
  getEngine(): LifecycleEngineLike | undefined;
  logger: LifecycleLoggerLike;
  /** Master switch. Defaults to true; `OS_LIFECYCLE_DISABLED=1` also wins. */
  enabled?: boolean;
  /** Cadence between sweeps. Default {@link DEFAULT_LIFECYCLE_SWEEP_MS}. */
  sweepIntervalMs?: number;
  /** Delay before the first sweep. Default {@link DEFAULT_LIFECYCLE_INITIAL_DELAY_MS}. */
  initialDelayMs?: number;
  /** Clock injection for deterministic tests. Defaults to `Date.now()`. */
  now?(): number;
}

export interface LifecycleSweepEntry {
  object: string;
  class: string;
  policy: 'ttl' | 'retention' | 'rotation' | 'rotation-fallback' | 'archive';
  cutoff: string;
  /** `undefined` when the driver doesn't report a count. */
  deleted?: number;
  /** Rotation only: expired shard tables DROPped this sweep (O(1) reclaim). */
  droppedShards?: number;
  /** Archive only: rows copied to the cold store (then hot-deleted). */
  archived?: number;
}

export interface LifecycleSweepReport {
  at: string;
  /** Policies applied, one entry per (object, policy). */
  swept: LifecycleSweepEntry[];
  /** Objects intentionally not swept, with the reason. */
  skipped: Array<{ object: string; reason: string }>;
  /** Isolated per-object failures — the sweep itself never throws. */
  errors: Array<{ object: string; error: string }>;
  /** Datasources whose driver reclaimed space after this sweep. */
  reclaimed: string[];
}

interface ReclaimCapableDriver {
  name?: string;
  reclaimSpace?(): Promise<void>;
}

interface RotationCapableDriver extends ReclaimCapableDriver {
  supportsRotation?: boolean;
  rotateShards?(
    objectDef: LifecycleObjectLike,
    nowMs?: number,
  ): Promise<{ object: string; current: string; shards: string[]; dropped: string[] }>;
}

/** Driver surface the Archiver uses on both the hot and the cold store. */
interface ArchiveCapableDriver {
  name?: string;
  find(object: string, query: Record<string, unknown>, options?: unknown): Promise<Array<Record<string, unknown>>>;
  upsert(object: string, data: Record<string, unknown>, conflictKeys?: string[], options?: unknown): Promise<unknown>;
  bulkDelete(object: string, ids: Array<string | number>, options?: unknown): Promise<void>;
  deleteMany?(object: string, query: Record<string, unknown>, options?: unknown): Promise<number>;
  syncSchema?(object: string, schema: unknown, options?: unknown): Promise<void>;
}

/** Max rows the Archiver moves per object per sweep — bounds sweep latency;
 * the backlog drains across consecutive sweeps. */
const ARCHIVE_BATCH_SIZE = 500;
const ARCHIVE_MAX_BATCHES_PER_SWEEP = 20;

export class LifecycleService {
  private readonly now: () => number;
  private timer: ReturnType<typeof setInterval> | undefined;
  private initialTimer: ReturnType<typeof setTimeout> | undefined;
  private sweeping = false;

  constructor(private readonly opts: LifecycleServiceOptions) {
    this.now = opts.now ?? (() => Date.now());
  }

  get enabled(): boolean {
    if (process.env.OS_LIFECYCLE_DISABLED === '1') return false;
    return this.opts.enabled !== false;
  }

  /** Arm the periodic sweep. Idempotent; timers are unref'ed so a kernel
   * shutdown is never held open by the lifecycle schedule. */
  start(): void {
    if (!this.enabled || this.timer || this.initialTimer) return;
    const interval = this.opts.sweepIntervalMs ?? DEFAULT_LIFECYCLE_SWEEP_MS;
    const initial = this.opts.initialDelayMs ?? DEFAULT_LIFECYCLE_INITIAL_DELAY_MS;
    this.initialTimer = setTimeout(() => {
      this.initialTimer = undefined;
      void this.sweep();
      this.timer = setInterval(() => void this.sweep(), interval);
      this.timer.unref?.();
    }, initial);
    this.initialTimer.unref?.();
  }

  stop(): void {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.timer) clearInterval(this.timer);
    this.initialTimer = undefined;
    this.timer = undefined;
  }

  /**
   * Apply every declared lifecycle policy once. Safe to call directly (the
   * dogfood growth gate and `db:clean`-style tooling do); re-entrant calls
   * while a sweep is running resolve to an empty report.
   */
  async sweep(): Promise<LifecycleSweepReport> {
    const report: LifecycleSweepReport = {
      at: new Date(this.now()).toISOString(),
      swept: [],
      skipped: [],
      errors: [],
      reclaimed: [],
    };
    if (this.sweeping || !this.enabled) return report;
    const engine = this.opts.getEngine();
    if (!engine || typeof engine.delete !== 'function' || !engine.registry) {
      this.opts.logger.debug?.('[lifecycle] no data engine available; sweep skipped');
      return report;
    }

    this.sweeping = true;
    try {
      const declared = engine.registry
        .getAllObjects()
        .filter((o) => o?.lifecycle && o.lifecycle.class !== 'record');

      // Drivers that should reclaim space after this sweep (deduped by
      // instance — several objects usually share one datasource).
      const reclaimable = new Set<ReclaimCapableDriver>();

      for (const obj of declared) {
        const lc = obj.lifecycle as Lifecycle;
        try {
          const outcomes = await this.reapObject(engine, obj, lc, report);
          const deletedSomething = outcomes.some((n) => n === undefined || n > 0);
          if (deletedSomething && lc.reclaim !== false) {
            const driver = engine.getDriverForObject(obj.name) as ReclaimCapableDriver | undefined;
            if (driver && typeof driver.reclaimSpace === 'function') reclaimable.add(driver);
          }
        } catch (err) {
          const msg = (err as Error)?.message ?? String(err);
          report.errors.push({ object: obj.name, error: msg });
          this.opts.logger.warn(`[lifecycle] sweep of ${obj.name} failed (${msg})`);
        }
      }

      for (const driver of reclaimable) {
        try {
          await driver.reclaimSpace!();
          report.reclaimed.push(driver.name ?? 'default');
        } catch (err) {
          this.opts.logger.warn(
            `[lifecycle] space reclaim on datasource '${driver.name ?? 'default'}' failed (${(err as Error)?.message ?? err})`,
          );
        }
      }

      if (report.swept.length > 0 || report.errors.length > 0) {
        // ADR-0057 §3.3: cleanup must not re-feed the tables it drains — one
        // aggregate log line per sweep is the entire trace it leaves.
        const total = report.swept.reduce((sum, e) => sum + (e.deleted ?? 0), 0);
        this.opts.logger.info(
          `[lifecycle] sweep: ${report.swept.length} policy(ies) applied, ~${total} rows reaped, ` +
            `${report.reclaimed.length} datasource(s) reclaimed, ${report.errors.length} error(s)`,
        );
      }
      return report;
    } finally {
      this.sweeping = false;
    }
  }

  /** Apply the policies declared on one object (Rotator first, then the
   * Reaper). Returns per-policy outcomes so the caller can decide on
   * reclaim: numbers are deleted-row counts; `undefined` means "work was
   * done but the driver reports no count" (also used for dropped shards). */
  private async reapObject(
    engine: LifecycleEngineLike,
    obj: LifecycleObjectLike,
    lc: Lifecycle,
    report: LifecycleSweepReport,
  ): Promise<Array<number | undefined>> {
    const object = obj.name;

    // Safety rule: declared `archive` means retain → archive → delete. Hot
    // deletion happens ONLY for rows the Archiver has copied to the cold
    // store; when the archive datasource isn't registered, rows are retained
    // (never dropped unarchived) and the object is reported as skipped.
    if (lc.archive) {
      return this.archiveObject(engine, obj, lc, report);
    }

    const outcomes: Array<number | undefined> = [];

    if (lc.ttl) {
      const cutoff = new Date(this.now() - parseLifecycleDuration(lc.ttl.expireAfter)).toISOString();
      outcomes.push(await this.reap(engine, object, lc, 'ttl', lc.ttl.field, cutoff, report));
    }

    // Rotation (P2): physical time-sharding when the driver supports it —
    // the window bound comes from DROPping expired shards (O(1) reclaim).
    // Drivers without rotation fall through to an equivalent age-based reap,
    // so the declared bound holds on every dialect.
    let rotated = false;
    if (lc.storage?.strategy === 'rotation') {
      const driver = engine.getDriverForObject(object) as RotationCapableDriver | undefined;
      if (driver && typeof driver.rotateShards === 'function' && driver.supportsRotation !== false) {
        const windowMs = lc.storage.shards * SHARD_UNIT_MS[lc.storage.unit];
        const res = await driver.rotateShards(obj, this.now());
        report.swept.push({
          object,
          class: lc.class,
          policy: 'rotation',
          cutoff: new Date(this.now() - windowMs).toISOString(),
          droppedShards: res.dropped.length,
        });
        // Dropped shards freed pages — signal the reclaim pass.
        outcomes.push(res.dropped.length > 0 ? undefined : 0);
        rotated = true;
      }
    }

    if (lc.retention) {
      // Runs even when rotation is active: rotation reclaims at SHARD
      // granularity, an explicit retention.maxAge trims to the day inside the
      // live shards — and immediately bounds a legacy table the Rotator just
      // adopted whole into its first shard.
      const cutoff = new Date(this.now() - parseLifecycleDuration(lc.retention.maxAge)).toISOString();
      outcomes.push(await this.reap(engine, object, lc, 'retention', 'created_at', cutoff, report));
    } else if (lc.storage?.strategy === 'rotation' && !rotated && !lc.ttl) {
      // Rotation declared but the driver can't shard physically: the shard
      // window IS the bound — enforce the same window with an age-based reap
      // so the declaration is never inert.
      const cutoff = new Date(this.now() - lc.storage.shards * SHARD_UNIT_MS[lc.storage.unit]).toISOString();
      outcomes.push(await this.reap(engine, object, lc, 'rotation-fallback', 'created_at', cutoff, report));
    }

    return outcomes;
  }

  /**
   * Archiver (ADR-0057 §3.3 / P3): copy rows past `archive.after` from the
   * hot store to the archive datasource, then delete the copied rows hot.
   * Batched (500 × 20 per sweep) so a large backlog drains across sweeps
   * without one long-locking pass. Copies are per-row idempotent upserts, so
   * a sweep interrupted between copy and hot-delete re-converges. When
   * `archive.keep` is set, cold rows past it are pruned from the archive.
   */
  private async archiveObject(
    engine: LifecycleEngineLike,
    obj: LifecycleObjectLike,
    lc: Lifecycle,
    report: LifecycleSweepReport,
  ): Promise<Array<number | undefined>> {
    const object = obj.name;
    const archive = lc.archive!;

    let cold: ArchiveCapableDriver | undefined;
    try {
      cold = engine.datasource?.(archive.to) as ArchiveCapableDriver | undefined;
    } catch {
      cold = undefined;
    }
    const hot = engine.getDriverForObject(object) as ArchiveCapableDriver | undefined;
    if (!cold || !hot || typeof hot.find !== 'function' || typeof cold.upsert !== 'function') {
      // No archive target ⇒ retain everything. A compliance ledger cannot be
      // destroyed by declaring a lifecycle — this is the safe default state
      // for deployments that never provision cold storage.
      report.skipped.push({ object, reason: 'archive-pending' });
      return [];
    }

    // The cold store mirrors the hot schema (idempotent DDL).
    if (typeof cold.syncSchema === 'function') {
      await cold.syncSchema(object, obj);
    }

    const cutoff = new Date(this.now() - parseLifecycleDuration(archive.after)).toISOString();
    let archived = 0;
    for (let batch = 0; batch < ARCHIVE_MAX_BATCHES_PER_SWEEP; batch++) {
      const rows = await hot.find(object, {
        where: { created_at: { $lt: cutoff } },
        limit: ARCHIVE_BATCH_SIZE,
      });
      if (!rows.length) break;
      for (const row of rows) {
        await cold.upsert(object, row, ['id']);
      }
      await hot.bulkDelete(object, rows.map((r) => r.id as string));
      archived += rows.length;
      if (rows.length < ARCHIVE_BATCH_SIZE) break;
    }

    // Cold-side retention: `keep` bounds the archive itself.
    if (archive.keep && typeof cold.deleteMany === 'function') {
      const keepCutoff = new Date(this.now() - parseLifecycleDuration(archive.keep)).toISOString();
      await cold.deleteMany(object, { where: { created_at: { $lt: keepCutoff } } });
    }

    report.swept.push({ object, class: lc.class, policy: 'archive', cutoff, archived });
    return [archived];
  }

  private async reap(
    engine: LifecycleEngineLike,
    object: string,
    lc: Lifecycle,
    policy: LifecycleSweepEntry['policy'],
    field: string,
    cutoff: string,
    report: LifecycleSweepReport,
  ): Promise<number | undefined> {
    const res = await engine.delete(object, {
      where: { [field]: { $lt: cutoff } },
      multi: true,
      context: { ...SYSTEM_CTX },
    });
    const deleted = countDeleted(res);
    report.swept.push({ object, class: lc.class, policy, cutoff, deleted });
    return deleted;
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
