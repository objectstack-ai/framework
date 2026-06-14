// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

export { JobServicePlugin } from './job-service-plugin.js';
export type { JobServicePluginOptions } from './job-service-plugin.js';
export { IntervalJobAdapter } from './interval-job-adapter.js';
export type { IntervalJobAdapterOptions } from './interval-job-adapter.js';
export { CronJobAdapter } from './cron-job-adapter.js';
export type { CronJobAdapterOptions } from './cron-job-adapter.js';
export { DbJobAdapter } from './db-job-adapter.js';
export type { DbJobAdapterOptions, JobEngineLike, JobLoggerLike } from './db-job-adapter.js';
export {
  JobRunRetention,
  DEFAULT_JOB_RUN_RETENTION_DAYS,
  DEFAULT_JOB_RUN_SWEEP_MS,
} from './job-run-retention.js';
export type {
  JobRunRetentionOptions,
  JobRunPruneOutcome,
} from './job-run-retention.js';
