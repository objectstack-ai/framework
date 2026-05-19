// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { Cron } from 'croner';
import type {
  IJobService,
  JobSchedule,
  JobHandler,
  JobExecution,
} from '@objectstack/spec/contracts';

/**
 * Configuration for the cron-based job adapter.
 */
export interface CronJobAdapterOptions {
  /** Timezone for cron expressions (default: 'UTC') */
  timezone?: string;
  /** Maximum execution history per job (default: 100) */
  maxExecutions?: number;
}

interface CronJobRecord {
  name: string;
  schedule: JobSchedule;
  handler: JobHandler;
  task?: Cron;
  executions: JobExecution[];
}

/**
 * Cron-based job adapter implementing IJobService using the `croner`
 * library. Honours per-job timezones, supports the standard 5-field cron
 * syntax, and falls back to setInterval / setTimeout for `interval` and
 * `once` schedule types (so a single CronJobAdapter can serve as the
 * "real" production job runner).
 */
export class CronJobAdapter implements IJobService {
  private readonly defaultTimezone: string;
  private readonly maxExecutions: number;
  private readonly jobs = new Map<string, CronJobRecord>();

  constructor(options: CronJobAdapterOptions = {}) {
    this.defaultTimezone = options.timezone ?? 'UTC';
    this.maxExecutions = options.maxExecutions ?? 100;
  }

  async schedule(name: string, schedule: JobSchedule, handler: JobHandler): Promise<void> {
    await this.cancel(name);

    const record: CronJobRecord = { name, schedule, handler, executions: [] };

    if (schedule.type === 'cron') {
      if (!schedule.expression) {
        throw new Error(`CronJobAdapter: cron schedule for "${name}" missing expression`);
      }
      const task = new Cron(
        schedule.expression,
        { timezone: schedule.timezone ?? this.defaultTimezone, name },
        async () => { await this.execute(record); },
      );
      record.task = task;
    } else if (schedule.type === 'interval' && schedule.intervalMs) {
      const handle = setInterval(() => { void this.execute(record); }, schedule.intervalMs);
      (handle as any)?.unref?.();
      // Use a sentinel Cron-like shape with stop() for cancel()
      record.task = { stop: () => clearInterval(handle) } as unknown as Cron;
    } else if (schedule.type === 'once' && schedule.at) {
      const delay = new Date(schedule.at).getTime() - Date.now();
      if (delay > 0) {
        const handle = setTimeout(() => { void this.execute(record); }, delay);
        (handle as any)?.unref?.();
        record.task = { stop: () => clearTimeout(handle) } as unknown as Cron;
      }
    }

    this.jobs.set(name, record);
  }

  async cancel(name: string): Promise<void> {
    const rec = this.jobs.get(name);
    if (rec?.task) {
      try { rec.task.stop(); } catch { /* ignore */ }
    }
    this.jobs.delete(name);
  }

  async trigger(name: string, data?: unknown): Promise<void> {
    const rec = this.jobs.get(name);
    if (!rec) throw new Error(`Job "${name}" not found`);
    await this.execute(rec, data);
  }

  async getExecutions(name: string, limit?: number): Promise<JobExecution[]> {
    const rec = this.jobs.get(name);
    if (!rec) return [];
    return limit ? rec.executions.slice(-limit) : rec.executions;
  }

  async listJobs(): Promise<string[]> {
    return [...this.jobs.keys()];
  }

  /** Stop all timers — call from plugin destroy. */
  async destroy(): Promise<void> {
    for (const rec of this.jobs.values()) {
      try { rec.task?.stop(); } catch { /* ignore */ }
    }
    this.jobs.clear();
  }

  private async execute(record: CronJobRecord, data?: unknown): Promise<void> {
    const execution: JobExecution = {
      jobId: record.name,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    const startMs = Date.now();
    try {
      await record.handler({ jobId: record.name, data });
      execution.status = 'success';
    } catch (err) {
      execution.status = 'failed';
      execution.error = err instanceof Error ? err.message : String(err);
    } finally {
      execution.completedAt = new Date().toISOString();
      execution.durationMs = Date.now() - startMs;
      record.executions.push(execution);
      if (record.executions.length > this.maxExecutions) {
        record.executions.splice(0, record.executions.length - this.maxExecutions);
      }
    }
  }
}
