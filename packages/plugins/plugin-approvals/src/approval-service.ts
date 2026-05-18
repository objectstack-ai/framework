// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ApprovalProcessSchema } from '@objectstack/spec/automation';
import type {
  IApprovalService,
  ApprovalProcessRow,
  ApprovalRequestRow,
  ApprovalActionRow,
  ApprovalDecisionInput,
  ApprovalDecisionResult,
  ApprovalStatus,
  DefineApprovalProcessInput,
  SubmitApprovalInput,
  SharingExecutionContext,
} from '@objectstack/spec/contracts';
import { executeActions, type ApprovalTrigger, type FetchLike } from './action-executor.js';

/**
 * Narrow engine surface — keeps the service testable without booting
 * a real ObjectQL kernel.
 */
export interface ApprovalEngine {
  find(object: string, options?: any): Promise<any[]>;
  insert(object: string, data: any, options?: any): Promise<any>;
  update(object: string, idOrData: any, dataOrOptions?: any, options?: any): Promise<any>;
  delete(object: string, options?: any): Promise<any>;
}

export interface ApprovalClock { now(): Date }

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

function uid(prefix: string): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return `${prefix}_${g.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseJson<T = any>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return fallback; }
  }
  return raw as T;
}

function csvSplit(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

function rowFromProcess(row: any): ApprovalProcessRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    label: String(row.label ?? ''),
    object_name: String(row.object_name ?? ''),
    description: row.description ?? undefined,
    active: row.active !== false,
    definition: parseJson(row.definition_json, {}),
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function rowFromRequest(row: any): ApprovalRequestRow {
  return {
    id: String(row.id),
    organization_id: row.organization_id ?? undefined,
    process_name: String(row.process_name ?? ''),
    object_name: String(row.object_name ?? ''),
    record_id: String(row.record_id ?? ''),
    submitter_id: row.submitter_id ?? undefined,
    submitter_comment: row.submitter_comment ?? undefined,
    status: (row.status as ApprovalStatus) ?? 'pending',
    current_step: row.current_step ?? undefined,
    current_step_index: row.current_step_index ?? undefined,
    pending_approvers: csvSplit(row.pending_approvers),
    payload: parseJson(row.payload_json, undefined),
    completed_at: row.completed_at ?? undefined,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  } as any;
}

function rowFromAction(row: any): ApprovalActionRow {
  return {
    id: String(row.id),
    request_id: String(row.request_id),
    step_name: row.step_name ?? undefined,
    step_index: row.step_index ?? undefined,
    action: row.action,
    actor_id: row.actor_id ?? undefined,
    comment: row.comment ?? undefined,
    created_at: row.created_at ?? undefined,
  };
}

/** Approver resolution — MVP: literal values for user/field, prefixed strings for role/manager/queue. */
function resolveApprovers(step: any, record?: any): string[] {
  const out: string[] = [];
  for (const a of (step.approvers ?? [])) {
    if (!a) continue;
    if (a.type === 'user') out.push(String(a.value));
    else if (a.type === 'field' && record) out.push(String((record as any)[a.value] ?? ''));
    else out.push(`${a.type}:${a.value}`);
  }
  return out.filter(Boolean);
}

export interface ApprovalServiceOptions {
  engine: ApprovalEngine;
  clock?: ApprovalClock;
  logger?: { info?: (msg: any, ...rest: any[]) => void; warn?: (msg: any, ...rest: any[]) => void; error?: (msg: any, ...rest: any[]) => void; debug?: (msg: any, ...rest: any[]) => void };
  /** Optional fetch impl for `webhook` actions; defaults to global. */
  fetch?: FetchLike;
  /** Webhook timeout in ms; default 5000. */
  webhookTimeoutMs?: number;
  /**
   * Called after the process registry changes (defineProcess / deleteProcess).
   * The plugin uses this to re-bind lifecycle hooks for auto-trigger / lock.
   */
  onRegistryChange?: () => void | Promise<void>;
}

export class ApprovalService implements IApprovalService {
  private readonly engine: ApprovalEngine;
  private readonly clock: ApprovalClock;
  private readonly logger?: ApprovalServiceOptions['logger'];
  private readonly fetchImpl?: FetchLike;
  private readonly webhookTimeoutMs?: number;
  private readonly onRegistryChange?: () => void | Promise<void>;

  constructor(opts: ApprovalServiceOptions) {
    this.engine = opts.engine;
    this.clock = opts.clock ?? { now: () => new Date() };
    this.logger = opts.logger;
    this.fetchImpl = opts.fetch;
    this.webhookTimeoutMs = opts.webhookTimeoutMs;
    this.onRegistryChange = opts.onRegistryChange;
  }

  /** Allow the plugin to attach a hook re-binding callback after construction. */
  setRegistryChangeHandler(handler: () => void | Promise<void>): void {
    (this as any).onRegistryChange = handler;
  }

  private async notifyRegistryChanged(): Promise<void> {
    const cb = this.onRegistryChange ?? ((this as any).onRegistryChange as (() => void | Promise<void>) | undefined);
    if (!cb) return;
    try { await cb(); }
    catch (err: any) { this.logger?.warn?.('[approvals] onRegistryChange handler failed', { error: err?.message }); }
  }

  /** Mirror request status onto `process.approvalStatusField` if configured. */
  private async syncStatusField(process: ApprovalProcessRow, request: ApprovalRequestRow): Promise<void> {
    const field = (process.definition as any)?.approvalStatusField;
    if (!field) return;
    try {
      await this.engine.update(
        process.object_name,
        { id: request.record_id, [field]: request.status },
        { context: SYSTEM_CTX },
      );
    } catch (err: any) {
      this.logger?.warn?.(`[approvals] syncStatusField failed: ${err?.message ?? err}`);
    }
  }

  /** Convenience wrapper that funnels every action invocation through the executor. */
  private async runActions(
    actions: any[] | undefined | null,
    trigger: ApprovalTrigger,
    process: ApprovalProcessRow,
    request: ApprovalRequestRow,
    step: any | undefined,
    actorId: string | null | undefined,
    comment: string | null | undefined,
  ): Promise<void> {
    if (!actions || actions.length === 0) return;
    await executeActions(actions, {
      trigger,
      process: { ...process, object: process.object_name },
      request,
      step,
      actorId: actorId ?? null,
      comment: comment ?? null,
    }, {
      engine: this.engine,
      logger: this.logger,
      fetch: this.fetchImpl,
      webhookTimeoutMs: this.webhookTimeoutMs,
    });
  }

  // ── Process definitions ──────────────────────────────────────

  async defineProcess(input: DefineApprovalProcessInput, _context: SharingExecutionContext): Promise<ApprovalProcessRow> {
    if (!input.name) throw new Error('VALIDATION_FAILED: name is required');
    if (!input.label) throw new Error('VALIDATION_FAILED: label is required');
    if (!input.object) throw new Error('VALIDATION_FAILED: object is required');
    if (!input.definition) throw new Error('VALIDATION_FAILED: definition is required');

    const parsed = ApprovalProcessSchema.safeParse(input.definition);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`VALIDATION_FAILED: ${msg}`);
    }

    const now = this.clock.now().toISOString();
    const payload: any = {
      name: input.name,
      label: input.label,
      object_name: input.object,
      description: input.description ?? null,
      active: input.active !== false,
      definition_json: JSON.stringify(parsed.data),
      updated_at: now,
    };

    // Upsert by name.
    const existing = await this.engine.find('sys_approval_process', {
      where: { name: input.name }, limit: 1, context: SYSTEM_CTX,
    });
    if (Array.isArray(existing) && existing[0]) {
      const id = existing[0].id;
      await this.engine.update('sys_approval_process', { id, ...payload }, { context: SYSTEM_CTX });
      const row = rowFromProcess({ ...existing[0], ...payload, id });
      await this.notifyRegistryChanged();
      return row;
    }

    const id = input.id ?? uid('apv');
    const row = { id, ...payload, created_at: now };
    await this.engine.insert('sys_approval_process', row, { context: SYSTEM_CTX });
    const out = rowFromProcess(row);
    await this.notifyRegistryChanged();
    return out;
  }

  async listProcesses(
    filter: { object?: string; activeOnly?: boolean } | undefined,
    _context: SharingExecutionContext,
  ): Promise<ApprovalProcessRow[]> {
    const f: any = {};
    if (filter?.object) f.object_name = filter.object;
    if (filter?.activeOnly) f.active = true;
    const rows = await this.engine.find('sys_approval_process', {
      where: f, limit: 500, orderBy: [{ field: 'updated_at', direction: 'desc' }], context: SYSTEM_CTX,
    });
    return Array.isArray(rows) ? rows.map(rowFromProcess) : [];
  }

  async getProcess(idOrName: string, _context: SharingExecutionContext): Promise<ApprovalProcessRow | null> {
    if (!idOrName) return null;
    let rows = await this.engine.find('sys_approval_process', {
      where: { id: idOrName }, limit: 1, context: SYSTEM_CTX,
    });
    if (!Array.isArray(rows) || !rows[0]) {
      rows = await this.engine.find('sys_approval_process', {
        where: { name: idOrName }, limit: 1, context: SYSTEM_CTX,
      });
    }
    return Array.isArray(rows) && rows[0] ? rowFromProcess(rows[0]) : null;
  }

  async deleteProcess(idOrName: string, context: SharingExecutionContext): Promise<void> {
    if (!idOrName) throw new Error('VALIDATION_FAILED: idOrName is required');
    const proc = await this.getProcess(idOrName, context);
    if (!proc) return;
    await this.engine.delete('sys_approval_process', { where: { id: proc.id }, context: SYSTEM_CTX });
    await this.notifyRegistryChanged();
  }

  // ── Requests ─────────────────────────────────────────────────

  async submit(input: SubmitApprovalInput, context: SharingExecutionContext): Promise<ApprovalRequestRow> {
    if (!input.object) throw new Error('VALIDATION_FAILED: object is required');
    if (!input.recordId) throw new Error('VALIDATION_FAILED: recordId is required');

    // Find active process for the object (or by name when supplied).
    let process: ApprovalProcessRow | null = null;
    if (input.processName) {
      process = await this.getProcess(input.processName, context);
      if (process && !process.active) {
        throw new Error(`NO_ACTIVE_PROCESS: process '${input.processName}' is not active`);
      }
    } else {
      const list = await this.listProcesses({ object: input.object, activeOnly: true }, context);
      process = list[0] ?? null;
    }
    if (!process) {
      throw new Error(`NO_ACTIVE_PROCESS: no active approval process for object '${input.object}'`);
    }

    // De-duplicate: only one pending request per (object, record).
    const existing = await this.engine.find('sys_approval_request', {
      where: { object_name: input.object, record_id: input.recordId, status: 'pending' },
      limit: 1, context: SYSTEM_CTX,
    });
    if (Array.isArray(existing) && existing[0]) {
      throw new Error(`DUPLICATE_REQUEST: a pending approval already exists for ${input.object}/${input.recordId}`);
    }

    const steps: any[] = process.definition?.steps ?? [];
    if (steps.length === 0) {
      throw new Error('VALIDATION_FAILED: process definition has no steps');
    }
    const step0 = steps[0];
    const approvers = resolveApprovers(step0, input.payload);

    const now = this.clock.now().toISOString();
    const id = uid('areq');
    const ctxOrg = (context as any)?.organizationId ?? (context as any)?.tenantId ?? null;
    const row: any = {
      id,
      process_name: process.name,
      object_name: input.object,
      record_id: input.recordId,
      submitter_id: input.submitterId ?? context.userId ?? null,
      submitter_comment: input.comment ?? null,
      status: 'pending',
      current_step: step0.name,
      current_step_index: 0,
      pending_approvers: approvers.join(','),
      payload_json: input.payload != null ? JSON.stringify(input.payload) : null,
      organization_id: ctxOrg,
      created_at: now,
      updated_at: now,
    };
    await this.engine.insert('sys_approval_request', row, { context: SYSTEM_CTX });

    // Audit: submit.
    await this.engine.insert('sys_approval_action', {
      id: uid('aact'),
      request_id: id,
      organization_id: ctxOrg,
      step_name: step0.name,
      step_index: 0,
      action: 'submit',
      actor_id: input.submitterId ?? context.userId ?? null,
      comment: input.comment ?? null,
      created_at: now,
    }, { context: SYSTEM_CTX });

    const requestRow = rowFromRequest(row);

    // Phase B: status mirror + onSubmit actions.
    await this.syncStatusField(process, requestRow);
    const definition: any = process.definition ?? {};
    await this.runActions(
      definition.onSubmit,
      'submit',
      process,
      requestRow,
      step0,
      input.submitterId ?? context.userId ?? null,
      input.comment ?? null,
    );

    return requestRow;
  }

  async listRequests(
    filter: {
      object?: string;
      recordId?: string;
      status?: ApprovalStatus | ApprovalStatus[];
      approverId?: string;
      submitterId?: string;
    } | undefined,
    context: SharingExecutionContext,
  ): Promise<ApprovalRequestRow[]> {
    const f: any = {};
    if (filter?.object) f.object_name = filter.object;
    if (filter?.recordId) f.record_id = filter.recordId;
    if (filter?.submitterId) f.submitter_id = filter.submitterId;
    // Tenant isolation: when a caller context carries a tenant identifier
    // (organizationId / tenantId), scope the query to that tenant. SYSTEM
    // callers (no tenant) see all rows. This prevents the bespoke endpoint
    // from leaking other-tenant rows since we deliberately query with
    // SYSTEM_CTX to bypass RLS on the engine (we need CSV substring match
    // on pending_approvers which RLS can't model cleanly).
    const tenantOrg = (context as any)?.organizationId ?? (context as any)?.tenantId;
    if (tenantOrg) f.organization_id = tenantOrg;
    // Status: when array, post-filter; when single, push into engine filter.
    let statusFilter: ApprovalStatus[] | undefined;
    if (Array.isArray(filter?.status)) statusFilter = filter!.status as ApprovalStatus[];
    else if (filter?.status) f.status = filter.status;

    const rows = await this.engine.find('sys_approval_request', {
      where: f, limit: 500, orderBy: [{ field: 'updated_at', direction: 'desc' }], context: SYSTEM_CTX,
    });
    let list = Array.isArray(rows) ? rows.map(rowFromRequest) : [];
    if (statusFilter) list = list.filter(r => statusFilter!.includes(r.status));
    if (filter?.approverId) {
      const target = filter.approverId;
      list = list.filter(r => (r.pending_approvers ?? []).includes(target));
    }
    return list;
  }

  async getRequest(requestId: string, context: SharingExecutionContext): Promise<ApprovalRequestRow | null> {
    if (!requestId) return null;
    const where: any = { id: requestId };
    const tenantOrg = (context as any)?.organizationId ?? (context as any)?.tenantId;
    if (tenantOrg) where.organization_id = tenantOrg;
    const rows = await this.engine.find('sys_approval_request', {
      where, limit: 1, context: SYSTEM_CTX,
    });
    return Array.isArray(rows) && rows[0] ? rowFromRequest(rows[0]) : null;
  }

  async approve(requestId: string, input: ApprovalDecisionInput, context: SharingExecutionContext): Promise<ApprovalDecisionResult> {
    const req = await this.getRequest(requestId, context);
    if (!req) throw new Error(`REQUEST_NOT_FOUND: ${requestId}`);
    if (req.status !== 'pending') throw new Error(`INVALID_STATE: request is ${req.status}`);
    if (!input?.actorId) throw new Error('VALIDATION_FAILED: actorId is required');

    if (!context.isSystem && !(req.pending_approvers ?? []).includes(input.actorId)) {
      throw new Error(`FORBIDDEN: actor '${input.actorId}' is not a pending approver`);
    }

    const process = await this.getProcess(req.process_name, context);
    if (!process) throw new Error(`PROCESS_NOT_FOUND: ${req.process_name}`);
    const steps: any[] = process.definition?.steps ?? [];
    const stepIndex = req.current_step_index ?? 0;
    const step = steps[stepIndex];
    if (!step) throw new Error(`INVALID_STATE: step index ${stepIndex} out of range`);

    const now = this.clock.now().toISOString();
    // Audit row first so unanimous tally sees it.
    await this.engine.insert('sys_approval_action', {
      id: uid('aact'),
      request_id: req.id,
      organization_id: (req as any).organization_id ?? null,
      step_name: step.name,
      step_index: stepIndex,
      action: 'approve',
      actor_id: input.actorId,
      comment: input.comment ?? null,
      created_at: now,
    }, { context: SYSTEM_CTX });

    // Unanimous: only advance once every original approver has approved at this step_index.
    if (step.behavior === 'unanimous') {
      const original = resolveApprovers(step, req.payload);
      const acts = await this.engine.find('sys_approval_action', {
        where: { request_id: req.id, step_index: stepIndex, action: 'approve' },
        limit: 500, context: SYSTEM_CTX,
      });
      const approved = new Set<string>((acts ?? []).map((a: any) => String(a.actor_id ?? '')).filter(Boolean));
      const stillPending = original.filter(a => !approved.has(a));
      if (stillPending.length > 0) {
        // Update pending_approvers to those who haven't voted yet.
        await this.engine.update('sys_approval_request', {
          id: req.id,
          pending_approvers: stillPending.join(','),
          updated_at: now,
        }, { context: SYSTEM_CTX });
        const fresh = await this.getRequest(req.id, context);
        return { request: fresh!, finalized: false };
      }
    }

    // Advance the request — either to next step or to finalized=approved.
    if (stepIndex + 1 >= steps.length) {
      await this.engine.update('sys_approval_request', {
        id: req.id,
        status: 'approved',
        pending_approvers: null,
        completed_at: now,
        updated_at: now,
      }, { context: SYSTEM_CTX });
      const fresh = await this.getRequest(req.id, context);
      // Phase B: step.onApprove + process.onFinalApprove + status mirror.
      await this.runActions((step as any)?.onApprove, 'step_approve', process, fresh!, step, input.actorId, input.comment);
      await this.syncStatusField(process, fresh!);
      await this.runActions((process.definition as any)?.onFinalApprove, 'final_approve', process, fresh!, step, input.actorId, input.comment);
      return { request: fresh!, finalized: true };
    }

    const nextStep = steps[stepIndex + 1];
    const nextApprovers = resolveApprovers(nextStep, req.payload);
    await this.engine.update('sys_approval_request', {
      id: req.id,
      current_step: nextStep.name,
      current_step_index: stepIndex + 1,
      pending_approvers: nextApprovers.join(','),
      updated_at: now,
    }, { context: SYSTEM_CTX });
    const fresh = await this.getRequest(req.id, context);
    // Phase B: step.onApprove fires when transitioning out of this step.
    await this.runActions((step as any)?.onApprove, 'step_approve', process, fresh!, step, input.actorId, input.comment);
    return { request: fresh!, finalized: false };
  }

  async reject(requestId: string, input: ApprovalDecisionInput, context: SharingExecutionContext): Promise<ApprovalDecisionResult> {
    const req = await this.getRequest(requestId, context);
    if (!req) throw new Error(`REQUEST_NOT_FOUND: ${requestId}`);
    if (req.status !== 'pending') throw new Error(`INVALID_STATE: request is ${req.status}`);
    if (!input?.actorId) throw new Error('VALIDATION_FAILED: actorId is required');
    if (!context.isSystem && !(req.pending_approvers ?? []).includes(input.actorId)) {
      throw new Error(`FORBIDDEN: actor '${input.actorId}' is not a pending approver`);
    }

    const process = await this.getProcess(req.process_name, context);
    if (!process) throw new Error(`PROCESS_NOT_FOUND: ${req.process_name}`);
    const steps: any[] = process.definition?.steps ?? [];
    const stepIndex = req.current_step_index ?? 0;
    const step = steps[stepIndex];

    const now = this.clock.now().toISOString();
    await this.engine.insert('sys_approval_action', {
      id: uid('aact'),
      request_id: req.id,
      organization_id: (req as any).organization_id ?? null,
      step_name: step?.name,
      step_index: stepIndex,
      action: 'reject',
      actor_id: input.actorId,
      comment: input.comment ?? null,
      created_at: now,
    }, { context: SYSTEM_CTX });

    if (step?.rejectionBehavior === 'back_to_previous' && stepIndex > 0) {
      const prev = steps[stepIndex - 1];
      const prevApprovers = resolveApprovers(prev, req.payload);
      await this.engine.update('sys_approval_request', {
        id: req.id,
        current_step: prev.name,
        current_step_index: stepIndex - 1,
        pending_approvers: prevApprovers.join(','),
        updated_at: now,
      }, { context: SYSTEM_CTX });
      const fresh = await this.getRequest(req.id, context);
      // Phase B: step-level onReject fires on non-final rejection too.
      await this.runActions((step as any)?.onReject, 'step_reject', process, fresh!, step, input.actorId, input.comment);
      return { request: fresh!, finalized: false };
    }

    await this.engine.update('sys_approval_request', {
      id: req.id,
      status: 'rejected',
      pending_approvers: null,
      completed_at: now,
      updated_at: now,
    }, { context: SYSTEM_CTX });
    const fresh = await this.getRequest(req.id, context);
    // Phase B: step.onReject + process.onFinalReject + status mirror.
    await this.runActions((step as any)?.onReject, 'step_reject', process, fresh!, step, input.actorId, input.comment);
    await this.syncStatusField(process, fresh!);
    await this.runActions((process.definition as any)?.onFinalReject, 'final_reject', process, fresh!, step, input.actorId, input.comment);
    return { request: fresh!, finalized: true };
  }

  async recall(requestId: string, input: ApprovalDecisionInput, context: SharingExecutionContext): Promise<ApprovalDecisionResult> {
    const req = await this.getRequest(requestId, context);
    if (!req) throw new Error(`REQUEST_NOT_FOUND: ${requestId}`);
    if (req.status !== 'pending') throw new Error(`INVALID_STATE: request is ${req.status}`);
    if (!input?.actorId) throw new Error('VALIDATION_FAILED: actorId is required');
    if (!context.isSystem && req.submitter_id && req.submitter_id !== input.actorId) {
      throw new Error(`FORBIDDEN: only the submitter can recall this request`);
    }

    const now = this.clock.now().toISOString();
    await this.engine.insert('sys_approval_action', {
      id: uid('aact'),
      request_id: req.id,
      organization_id: (req as any).organization_id ?? null,
      step_name: req.current_step,
      step_index: req.current_step_index,
      action: 'recall',
      actor_id: input.actorId,
      comment: input.comment ?? null,
      created_at: now,
    }, { context: SYSTEM_CTX });

    await this.engine.update('sys_approval_request', {
      id: req.id,
      status: 'recalled',
      pending_approvers: null,
      completed_at: now,
      updated_at: now,
    }, { context: SYSTEM_CTX });
    const fresh = await this.getRequest(req.id, context);
    // Phase B: process.onRecall + status mirror.
    const process = await this.getProcess(req.process_name, context);
    if (process) {
      await this.syncStatusField(process, fresh!);
      await this.runActions((process.definition as any)?.onRecall, 'recall', process, fresh!, undefined, input.actorId, input.comment);
    }
    return { request: fresh!, finalized: true };
  }

  async listActions(requestId: string, context: SharingExecutionContext): Promise<ApprovalActionRow[]> {
    if (!requestId) return [];
    // Tenant gate: ensure the caller can see the parent request before
    // returning its action history. Skipping this would leak history rows
    // across tenants the same way the unscoped list-requests path did.
    const req = await this.getRequest(requestId, context);
    if (!req) return [];
    const rows = await this.engine.find('sys_approval_action', {
      where: { request_id: requestId },
      limit: 500,
      orderBy: [{ field: 'created_at', direction: 'asc' }],
      context: SYSTEM_CTX,
    });
    return Array.isArray(rows) ? rows.map(rowFromAction) : [];
  }
}
