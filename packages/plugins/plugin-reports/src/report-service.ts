// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type {
  IReportService,
  SavedReport,
  ReportSchedule,
  ReportQuery,
  ReportRunResult,
  ReportFormat,
  SaveReportInput,
  ScheduleReportInput,
  SharingExecutionContext,
} from '@objectstack/spec/contracts';
import { Cron } from 'croner';

/**
 * Narrow engine surface — keeps the service testable without booting
 * a real ObjectQL kernel.
 */
export interface ReportEngine {
  find(object: string, options?: any): Promise<any[]>;
  findOne?(object: string, options?: any): Promise<any>;
  insert(object: string, data: any, options?: any): Promise<any>;
  update(object: string, idOrData: any, dataOrOptions?: any, options?: any): Promise<any>;
  delete(object: string, options?: any): Promise<any>;
}

/**
 * Minimum email surface — implementations may pass the full
 * `IEmailService` instance straight through.
 */
export interface ReportEmail {
  send(input: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename: string; content: string; contentType?: string }>;
    relatedObject?: string;
    relatedId?: string;
  }): Promise<{ status: 'sent' | 'queued' | 'failed' }>;
}

/** Stamped only in tests / specialised callers to make `now` deterministic. */
export interface ReportClock { now(): Date }

const SYSTEM_CTX = { isSystem: true, positions: [], permissions: [] } as const;

const DEFAULT_FORMAT: ReportFormat = 'csv';
const DEFAULT_INTERVAL_MIN = 1440;
const DEFAULT_LIMIT = 1000;

function uid(prefix: string): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseQuery(raw: unknown): ReportQuery {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as ReportQuery; }
    catch { return {}; }
  }
  if (typeof raw === 'object') return raw as ReportQuery;
  return {};
}

function rowFromSaved(row: any): SavedReport {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description ?? undefined,
    object_name: String(row.object_name ?? ''),
    query: parseQuery(row.query_json),
    format: (row.format as ReportFormat) ?? DEFAULT_FORMAT,
    owner_id: row.owner_id ?? undefined,
    last_run_at: row.last_run_at ?? undefined,
    last_row_count: row.last_row_count ?? undefined,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function rowFromSchedule(row: any): ReportSchedule {
  return {
    id: String(row.id),
    report_id: String(row.report_id),
    name: row.name ?? undefined,
    interval_minutes: row.interval_minutes ?? undefined,
    cron_expression: row.cron_expression ?? undefined,
    timezone: row.timezone ?? undefined,
    active: row.active !== false,
    recipients: String(row.recipients ?? ''),
    format: row.format ?? undefined,
    subject_template: row.subject_template ?? undefined,
    owner_id: row.owner_id ?? undefined,
    next_run_at: row.next_run_at ?? undefined,
    last_sent_at: row.last_sent_at ?? undefined,
    last_status: row.last_status ?? undefined,
    last_error: row.last_error ?? undefined,
  };
}

// ─── Rendering ─────────────────────────────────────────────────────

function escapeCsvCell(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pickFields(rows: any[], explicit?: string[]): string[] {
  if (explicit && explicit.length > 0) return explicit;
  const seen = new Set<string>();
  for (const r of rows.slice(0, 50)) {
    if (r && typeof r === 'object') for (const k of Object.keys(r)) seen.add(k);
  }
  return Array.from(seen);
}

function renderCsv(rows: any[], fields?: string[]): string {
  const cols = pickFields(rows, fields);
  const head = cols.join(',');
  const body = rows.map(r => cols.map(c => escapeCsvCell(r?.[c])).join(',')).join('\r\n');
  return body.length > 0 ? `${head}\r\n${body}` : head;
}

function renderJson(rows: any[]): string {
  return JSON.stringify(rows, null, 2);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]);
}

function renderHtmlTable(rows: any[], fields?: string[]): string {
  const cols = pickFields(rows, fields);
  const th = cols.map(c => `<th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">${escapeHtml(c)}</th>`).join('');
  const trs = rows.map(r => {
    const tds = cols.map(c => {
      const v = r?.[c];
      const s = v == null ? '' : (typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
      return `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(s)}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table style="border-collapse:collapse;font-family:system-ui,Arial,sans-serif;font-size:13px;">`
    + `<thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function renderReport(rows: any[], format: ReportFormat, fields?: string[]): string {
  switch (format) {
    case 'json': return renderJson(rows);
    case 'html_table': return renderHtmlTable(rows, fields);
    case 'csv':
    default: return renderCsv(rows, fields);
  }
}

// ─── Subject templating (minimal {{var}}) ─────────────────────────

function renderSubject(template: string | undefined, vars: Record<string, string>): string {
  const tpl = template ?? '{{name}} — {{date}}';
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[String(k)] ?? '');
}

// ─── Service ──────────────────────────────────────────────────────

export interface ReportServiceOptions {
  engine: ReportEngine;
  email?: ReportEmail;
  clock?: ReportClock;
  logger?: { info?: (msg: any, ...rest: any[]) => void; warn?: (msg: any, ...rest: any[]) => void; error?: (msg: any, ...rest: any[]) => void };
  /** Cap rows per report to protect both DB and email size. */
  maxRows?: number;
}

export class ReportService implements IReportService {
  private readonly engine: ReportEngine;
  private readonly email?: ReportEmail;
  private readonly clock: ReportClock;
  private readonly logger: NonNullable<ReportServiceOptions['logger']>;
  private readonly maxRows: number;

  constructor(opts: ReportServiceOptions) {
    this.engine = opts.engine;
    this.email = opts.email;
    this.clock = opts.clock ?? { now: () => new Date() };
    this.logger = opts.logger ?? {};
    this.maxRows = Math.max(1, opts.maxRows ?? 5000);
  }

  // ── Report CRUD ────────────────────────────────────────────────

  async saveReport(input: SaveReportInput, context: SharingExecutionContext): Promise<SavedReport> {
    if (!input.name) throw new Error('VALIDATION_FAILED: name is required');
    if (!input.object) throw new Error('VALIDATION_FAILED: object is required');
    if (!input.query) throw new Error('VALIDATION_FAILED: query is required');

    const now = this.clock.now().toISOString();
    const payload: any = {
      name: input.name,
      description: input.description ?? null,
      object_name: input.object,
      query_json: JSON.stringify(input.query ?? {}),
      format: input.format ?? DEFAULT_FORMAT,
      owner_id: input.ownerId ?? context.userId ?? null,
      updated_at: now,
    };

    if (input.id) {
      const existing = await this.engine.find('sys_saved_report', {
        filter: { id: input.id }, limit: 1, context: SYSTEM_CTX,
      });
      if (Array.isArray(existing) && existing[0]) {
        await this.engine.update('sys_saved_report', { id: input.id, ...payload }, { context: SYSTEM_CTX });
        return rowFromSaved({ ...existing[0], ...payload, id: input.id });
      }
    }

    const id = input.id ?? uid('rpt');
    const row = { id, ...payload, created_at: now };
    await this.engine.insert('sys_saved_report', row, { context: SYSTEM_CTX });
    return rowFromSaved(row);
  }

  async listReports(
    filter: { object?: string; ownerId?: string } | undefined,
    _context: SharingExecutionContext,
  ): Promise<SavedReport[]> {
    const f: any = {};
    if (filter?.object) f.object_name = filter.object;
    if (filter?.ownerId) f.owner_id = filter.ownerId;
    const rows = await this.engine.find('sys_saved_report', {
      filter: f, limit: 500, orderBy: [{ field: 'updated_at', order: 'desc' }], context: SYSTEM_CTX,
    });
    return Array.isArray(rows) ? rows.map(rowFromSaved) : [];
  }

  async getReport(reportId: string, _context: SharingExecutionContext): Promise<SavedReport | null> {
    const rows = await this.engine.find('sys_saved_report', {
      filter: { id: reportId }, limit: 1, context: SYSTEM_CTX,
    });
    return Array.isArray(rows) && rows[0] ? rowFromSaved(rows[0]) : null;
  }

  async deleteReport(reportId: string, _context: SharingExecutionContext): Promise<void> {
    if (!reportId) throw new Error('VALIDATION_FAILED: reportId is required');
    // Cascade — drop attached schedules first.
    const schedules = await this.engine.find('sys_report_schedule', {
      filter: { report_id: reportId }, limit: 500, context: SYSTEM_CTX,
    });
    for (const s of (schedules ?? [])) {
      await this.engine.delete('sys_report_schedule', { where: { id: (s as any).id }, context: SYSTEM_CTX });
    }
    await this.engine.delete('sys_saved_report', { where: { id: reportId }, context: SYSTEM_CTX });
  }

  // ── Execution ───────────────────────────────────────────────────

  async run(reportId: string, context: SharingExecutionContext): Promise<ReportRunResult> {
    const report = await this.getReport(reportId, context);
    if (!report) throw new Error(`REPORT_NOT_FOUND: ${reportId}`);
    return this.executeReport(report, context);
  }

  async runAdHoc(input: SaveReportInput, context: SharingExecutionContext): Promise<ReportRunResult> {
    if (!input.object) throw new Error('VALIDATION_FAILED: object is required');
    if (!input.query) throw new Error('VALIDATION_FAILED: query is required');
    const adhoc: SavedReport = {
      id: '__adhoc__',
      name: input.name ?? 'Ad-hoc report',
      object_name: input.object,
      query: input.query,
      format: input.format ?? DEFAULT_FORMAT,
    };
    return this.executeReport(adhoc, context, /* stamp */ false);
  }

  private async executeReport(
    report: SavedReport,
    context: SharingExecutionContext,
    stamp = true,
  ): Promise<ReportRunResult> {
    const q = report.query ?? {};
    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, this.maxRows);
    const rows = await this.engine.find(report.object_name, {
      filter: q.filter,
      fields: q.fields,
      orderBy: q.orderBy,
      limit,
      // Reports execute with the caller's identity so sharing rules
      // (if installed) apply. Falls back to system bypass only when
      // the report definition was created by a system writer.
      context: {
        userId: context.userId,
        tenantId: context.tenantId,
        positions: context.positions ?? [],
        permissions: context.permissions ?? [],
        isSystem: context.isSystem ?? false,
      },
    });
    const list = Array.isArray(rows) ? rows : [];
    const body = renderReport(list, report.format, q.fields);
    const ranAt = this.clock.now().toISOString();

    if (stamp && report.id !== '__adhoc__') {
      try {
        await this.engine.update('sys_saved_report', {
          id: report.id,
          last_run_at: ranAt,
          last_row_count: list.length,
          updated_at: ranAt,
        }, { context: SYSTEM_CTX });
      } catch (err) {
        this.logger.warn?.('ReportService: failed to stamp last_run_at', err);
      }
    }

    return {
      reportId: report.id,
      rowCount: list.length,
      format: report.format,
      body,
      rows: list,
      ranAt,
    };
  }

  // ── Schedules ──────────────────────────────────────────────────

  async scheduleReport(input: ScheduleReportInput, context: SharingExecutionContext): Promise<ReportSchedule> {
    if (!input.reportId) throw new Error('VALIDATION_FAILED: reportId is required');
    if (!input.recipients || input.recipients.length === 0) {
      throw new Error('VALIDATION_FAILED: recipients must be a non-empty array');
    }
    const report = await this.getReport(input.reportId, context);
    if (!report) throw new Error(`REPORT_NOT_FOUND: ${input.reportId}`);

    const now = this.clock.now();
    const interval = input.intervalMinutes ?? DEFAULT_INTERVAL_MIN;
    const cron = input.cronExpression?.trim() || null;
    if (cron) {
      // Validate eagerly so an author gets a clear error at schedule time
      // instead of a schedule that silently falls back to interval on sweep.
      try {
        new Cron(cron, { timezone: input.timezone || 'UTC' });
      } catch (err) {
        throw new Error(`VALIDATION_FAILED: invalid cron_expression '${cron}': ${(err as Error).message}`);
      }
    }
    const nextRun = this.nextRunAt(
      { cron_expression: cron, interval_minutes: interval, timezone: input.timezone ?? 'UTC' },
      now,
    ).toISOString();
    const id = uid('rsch');
    const row: any = {
      id,
      report_id: input.reportId,
      name: input.name ?? null,
      interval_minutes: interval,
      cron_expression: cron,
      timezone: input.timezone ?? 'UTC',
      active: input.active !== false,
      recipients: input.recipients.join(','),
      format: input.format ?? 'html_table',
      subject_template: input.subjectTemplate ?? null,
      owner_id: input.ownerId ?? context.userId ?? null,
      next_run_at: nextRun,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    await this.engine.insert('sys_report_schedule', row, { context: SYSTEM_CTX });
    return rowFromSchedule(row);
  }

  async unscheduleReport(scheduleId: string, _context: SharingExecutionContext): Promise<void> {
    if (!scheduleId) throw new Error('VALIDATION_FAILED: scheduleId is required');
    await this.engine.delete('sys_report_schedule', { where: { id: scheduleId }, context: SYSTEM_CTX });
  }

  async listSchedules(
    filter: { reportId?: string } | undefined,
    _context: SharingExecutionContext,
  ): Promise<ReportSchedule[]> {
    const f: any = {};
    if (filter?.reportId) f.report_id = filter.reportId;
    const rows = await this.engine.find('sys_report_schedule', {
      filter: f, limit: 500, orderBy: [{ field: 'next_run_at', order: 'asc' }], context: SYSTEM_CTX,
    });
    return Array.isArray(rows) ? rows.map(rowFromSchedule) : [];
  }

  // ── Dispatcher ─────────────────────────────────────────────────

  async dispatchDue(now?: Date): Promise<{ fired: number; failed: number; skipped: number }> {
    const ts = (now ?? this.clock.now()).toISOString();
    const due = await this.engine.find('sys_report_schedule', {
      filter: { active: true },
      limit: 200,
      context: SYSTEM_CTX,
    });
    const list = (Array.isArray(due) ? due : []).map(rowFromSchedule)
      .filter(s => !s.next_run_at || s.next_run_at <= ts);

    let fired = 0, failed = 0, skipped = 0;
    for (const schedule of list) {
      try {
        const report = await this.getReport(schedule.report_id, { isSystem: true });
        if (!report) {
          skipped++;
          await this.markSchedule(schedule.id, {
            last_status: 'skipped',
            last_error: `report ${schedule.report_id} missing`,
          });
          continue;
        }
        // Force the schedule's own format so the recipient gets what
        // the admin configured (CSV attachment vs inline HTML table).
        const fmt: ReportFormat = (schedule.format ?? 'html_table') as ReportFormat;
        const result = await this.executeReport({ ...report, format: fmt }, { isSystem: true }, false);

        const recipients = schedule.recipients.split(',').map(s => s.trim()).filter(Boolean);
        const subject = renderSubject(schedule.subject_template, {
          name: schedule.name ?? report.name,
          date: ts.slice(0, 10),
          rows: String(result.rowCount),
        });

        if (this.email && recipients.length > 0) {
          if (fmt === 'csv') {
            await this.email.send({
              to: recipients,
              subject,
              text: `Attached: ${result.rowCount} row(s).`,
              attachments: [{
                // Keep unicode letters (CJK schedule names) — only strip
                // filesystem-hostile characters, else 周报 becomes `__`.
                filename: `${(schedule.name ?? report.name).replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '') || 'report'}-${ts.slice(0, 10)}.csv`,
                content: result.body,
                contentType: 'text/csv',
              }],
              relatedObject: 'sys_report_schedule',
              relatedId: schedule.id,
            });
          } else {
            await this.email.send({
              to: recipients,
              subject,
              html: `<p>${escapeHtml(report.name)} — ${result.rowCount} row(s)</p>${result.body}`,
              text: `${report.name} — ${result.rowCount} row(s)`,
              relatedObject: 'sys_report_schedule',
              relatedId: schedule.id,
            });
          }
        } else if (!this.email) {
          this.logger.warn?.('ReportService.dispatchDue: no email service — schedule fired but mail not sent');
        }

        await this.advanceSchedule(schedule, ts);
        fired++;
      } catch (err: any) {
        failed++;
        await this.markSchedule(schedule.id, {
          last_status: 'failed',
          last_error: String(err?.message ?? err ?? 'unknown').slice(0, 500),
        });
        this.logger.error?.('ReportService.dispatchDue: schedule failed', err);
      }
    }
    return { fired, failed, skipped };
  }

  /**
   * Compute the next fire time for a schedule. A `cron_expression` wins over
   * `interval_minutes` (the documented `sys_report_schedule` contract) and is
   * evaluated in the schedule's `timezone` (default UTC) via croner — the same
   * library the job scheduler uses. Falls back to `from + interval_minutes` for
   * interval schedules, and also if a cron expression is invalid or has no
   * future occurrence (logged; never throws into the sweep). `from` is the
   * reference instant (the injected clock), so `today()`-style boundaries honor
   * the test clock.
   */
  private nextRunAt(
    schedule: { cron_expression?: string | null; interval_minutes?: number | null; timezone?: string | null },
    from: Date,
  ): Date {
    const cron = (schedule.cron_expression ?? '').trim();
    if (cron) {
      try {
        const next = new Cron(cron, { timezone: schedule.timezone || 'UTC' }).nextRun(from);
        if (next) return next;
        this.logger.warn?.(`ReportService: cron '${cron}' has no next occurrence; falling back to interval`);
      } catch (err) {
        this.logger.warn?.(`ReportService: invalid cron '${cron}'; falling back to interval`, err);
      }
    }
    const interval = schedule.interval_minutes ?? DEFAULT_INTERVAL_MIN;
    return new Date(from.getTime() + interval * 60_000);
  }

  private async advanceSchedule(schedule: ReportSchedule, ranAt: string): Promise<void> {
    const nextRun = this.nextRunAt(schedule, this.clock.now()).toISOString();
    await this.engine.update('sys_report_schedule', {
      id: schedule.id,
      next_run_at: nextRun,
      last_sent_at: ranAt,
      last_status: 'ok',
      last_error: null,
      updated_at: ranAt,
    }, { context: SYSTEM_CTX });
  }

  private async markSchedule(id: string, patch: Record<string, unknown>): Promise<void> {
    try {
      await this.engine.update('sys_report_schedule', {
        id, ...patch, updated_at: this.clock.now().toISOString(),
      }, { context: SYSTEM_CTX });
    } catch (err) {
      this.logger.warn?.('ReportService: failed to mark schedule', err);
    }
  }
}
