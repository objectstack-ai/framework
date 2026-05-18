// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-reports
 *
 * Saved reports + scheduled email digests for ObjectStack.
 * Persists `sys_saved_report` definitions and `sys_report_schedule`
 * rows, then drives a dispatcher that runs due schedules and emails
 * the rendered output via the configured `email` service.
 */

export { SysSavedReport, SysReportSchedule } from '@objectstack/platform-objects/audit';
export {
  ReportService,
  renderReport,
  type ReportEngine,
  type ReportEmail,
  type ReportClock,
  type ReportServiceOptions,
} from './report-service.js';
export {
  ReportsServicePlugin,
  type ReportsPluginOptions,
} from './reports-plugin.js';
export type {
  IReportService,
  SavedReport,
  ReportSchedule,
  ReportQuery,
  ReportRunResult,
  ReportFormat,
  SaveReportInput,
  ScheduleReportInput,
} from '@objectstack/spec/contracts';
