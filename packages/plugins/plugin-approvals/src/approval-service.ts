// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { ApprovalProcessSchema, type ApprovalNodeConfig } from '@objectstack/spec/automation';
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
import type { MetadataRepository } from '@objectstack/metadata-core';
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
    process_hash: row.process_hash ?? undefined,
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

// Note: legacy synchronous `resolveApprovers` removed in M10.17.1 — replaced
// by the async `expandApprovers` member which routes through the team/dept
// graph tables (with prefixed-literal fallback for back-compat).

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
  /**
   * Optional metadata repository for execution-pinned process resolution
   * (ADR-0009). When provided:
   *
   *   - `submit()` records the process body's sha256 on the request row.
   *   - `approve` / `reject` / `recall` resolve the pinned body via
   *     `MetadataRepository.getByHash` so process upgrades don't affect
   *     in-flight requests.
   *
   * When omitted, the service reads the current process from the
   * `sys_approval_process` projection (pre-ADR-0009 behaviour).
   */
  metadataRepo?: MetadataRepository;
}

export class ApprovalService implements IApprovalService {
  private readonly engine: ApprovalEngine;
  private readonly clock: ApprovalClock;
  private readonly logger?: ApprovalServiceOptions['logger'];
  private readonly fetchImpl?: FetchLike;
  private readonly webhookTimeoutMs?: number;
  private readonly onRegistryChange?: () => void | Promise<void>;
  private readonly metadataRepo?: MetadataRepository;

  constructor(opts: ApprovalServiceOptions) {
    this.engine = opts.engine;
    this.clock = opts.clock ?? { now: () => new Date() };
    this.logger = opts.logger;
    this.fetchImpl = opts.fetch;
    this.webhookTimeoutMs = opts.webhookTimeoutMs;
    this.onRegistryChange = opts.onRegistryChange;
    this.metadataRepo = opts.metadataRepo;
  }

  /** Allow the plugin to attach a hook re-binding callback after construction. */
  setRegistryChangeHandler(handler: () => void | Promise<void>): void {
    (this as any).onRegistryChange = handler;
  }

  /**
   * Expand the approvers on a step into user IDs by querying the graph
   * tables for `team:` / `department:` / `role:` / `manager:` approver
   * types. Falls back to a prefixed literal (`type:value`) when graph
   * lookups produce nothing — so existing test fixtures and approver
   * flows that rely on substring matching keep working.
   *
   * **Graph semantics (M10.17.1):**
   *   - `team`       → flat members of `sys_team` (better-auth; no BFS)
   *   - `department` → recursive BFS of `sys_department.parent_department_id`
   *                    → members of every descendant via `sys_department_member`
   *   - `role`       → users with `sys_member.role = value` in tenant
   *   - `manager`    → `sys_user.manager_id` of `record[value] ?? record.owner_id`
   *   - `field`      → literal user id stored in `record[value]`
   *   - `user`       → literal value
   */
  private async expandApprovers(step: any, record?: any, organizationId?: string | null): Promise<string[]> {
    if (!step || !Array.isArray(step.approvers)) return [];
    const out: string[] = [];
    for (const a of step.approvers) {
      if (!a) continue;
      if (a.type === 'user') { out.push(String(a.value)); continue; }
      if (a.type === 'field' && record) { out.push(String((record as any)[a.value] ?? '')); continue; }
      try {
        if (a.type === 'team') {
          const users = await this.expandTeamUsers(String(a.value));
          if (users.length) { for (const u of users) out.push(u); continue; }
        } else if (a.type === 'department' || a.type === 'dept') {
          const users = await this.expandDepartmentUsers(String(a.value), organizationId);
          if (users.length) { for (const u of users) out.push(u); continue; }
        } else if (a.type === 'role') {
          const users = await this.expandRoleUsers(String(a.value), organizationId);
          if (users.length) { for (const u of users) out.push(u); continue; }
        } else if (a.type === 'manager' && record) {
          const subject = (record as any)[a.value] ?? (record as any).owner_id;
          if (subject) {
            const mgr = await this.lookupManager(String(subject));
            if (mgr) { out.push(mgr); continue; }
          }
        }
      } catch { /* fall through */ }
      out.push(`${a.type}:${a.value}`);
    }
    return out.filter(Boolean);
  }

  /** Flat team — `sys_team` is better-auth's collaboration grouping (no hierarchy). */
  private async expandTeamUsers(teamId: string): Promise<string[]> {
    if (!teamId) return [];
    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_team_member', {
        filter: { team_id: teamId },
        fields: ['user_id'],
        limit: 10000,
        context: SYSTEM_CTX,
      } as any);
    } catch { rows = []; }
    return Array.from(new Set((rows ?? []).map((r: any) => String(r.user_id ?? '')).filter(Boolean)));
  }

  /** Recursive department — walks `sys_department.parent_department_id`. */
  private async expandDepartmentUsers(departmentId: string, organizationId?: string | null): Promise<string[]> {
    if (!departmentId) return [];
    // Seed sanity check: skip if dept doesn't exist or is inactive within tenant.
    try {
      const seed = await this.engine.find('sys_department', {
        filter: organizationId
          ? { id: departmentId, organization_id: organizationId }
          : { id: departmentId },
        fields: ['id', 'active'],
        limit: 1,
        context: SYSTEM_CTX,
      } as any);
      const seedRow: any = Array.isArray(seed) ? seed[0] : null;
      if (!seedRow || seedRow.active === false) return [];
    } catch { return []; }

    const seen = new Set<string>([departmentId]);
    const queue: string[] = [departmentId];
    while (queue.length) {
      const parent = queue.shift()!;
      let kids: any[] = [];
      try {
        const filter: any = { parent_department_id: parent, active: { $ne: false } };
        if (organizationId) filter.organization_id = organizationId;
        kids = await this.engine.find('sys_department', { filter, fields: ['id'], limit: 1000, context: SYSTEM_CTX } as any);
      } catch { kids = []; }
      for (const k of kids ?? []) {
        const kid = String((k as any).id ?? '');
        if (kid && !seen.has(kid)) { seen.add(kid); queue.push(kid); }
      }
    }
    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_department_member', {
        filter: { department_id: { $in: Array.from(seen) } },
        fields: ['user_id'],
        limit: 10000,
        context: SYSTEM_CTX,
      } as any);
    } catch { rows = []; }
    return Array.from(new Set((rows ?? []).map((r: any) => String(r.user_id ?? '')).filter(Boolean)));
  }

  private async expandRoleUsers(roleName: string, organizationId?: string | null): Promise<string[]> {
    if (!roleName) return [];
    const filter: any = { role: roleName };
    if (organizationId) filter.organization_id = organizationId;
    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_member', { filter, fields: ['user_id'], limit: 10000, context: SYSTEM_CTX } as any);
    } catch { rows = []; }
    return Array.from(new Set((rows ?? []).map((r: any) => String(r.user_id ?? '')).filter(Boolean)));
  }

  private async lookupManager(userId: string): Promise<string | null> {
    try {
      const rows = await this.engine.find('sys_user', {
        filter: { id: userId }, fields: ['id', 'manager_id'], limit: 1, context: SYSTEM_CTX,
      } as any);
      const row: any = Array.isArray(rows) ? rows[0] : null;
      return row?.manager_id ? String(row.manager_id) : null;
    } catch { return null; }
  }


  private async notifyRegistryChanged(): Promise<void> {
    const cb = this.onRegistryChange ?? ((this as any).onRegistryChange as (() => void | Promise<void>) | undefined);
    if (!cb) return;
    try { await cb(); }
    catch (err: any) { this.logger?.warn?.('[approvals] onRegistryChange handler failed', { error: err?.message }); }
  }

  /**
   * Look up the HEAD checksum of an approval process from the metadata repo
   * (ADR-0009). Returns null when no repo is wired, no metadata exists for
   * the name, or the lookup fails — callers MUST treat null as "do not pin"
   * and fall back to the projection table.
   */
  private async resolveProcessHash(processName: string, organizationId?: string | null): Promise<string | null> {
    if (!this.metadataRepo) return null;
    if (!processName) return null;
    const orgRef = { org: organizationId || 'system', type: 'approval' as const, name: processName };
    try {
      const head = await this.metadataRepo.get(orgRef);
      return head?.hash ?? null;
    } catch (err: any) {
      this.logger?.debug?.('[approvals] metadataRepo.get failed', { name: processName, error: err?.message });
      return null;
    }
  }

  /**
   * Resolve the approval process for an in-flight request, honouring
   * ADR-0009 execution pinning when a `process_hash` is recorded.
   *
   * Resolution order:
   *   1. If `req.process_hash` AND `metadataRepo` are set, try
   *      `getByHash` — return a row whose `definition` is the pinned body.
   *   2. Otherwise (or on lookup failure) fall back to the current
   *      projection via `getProcess(req.process_name)`.
   */
  private async loadProcessForRequest(req: ApprovalRequestRow, context: SharingExecutionContext): Promise<ApprovalProcessRow | null> {
    const hash = req.process_hash;
    if (hash && this.metadataRepo) {
      const orgId = (req as any).organization_id ?? null;
      const orgRef = { org: orgId || 'system', type: 'approval' as const, name: req.process_name };
      try {
        const pinned = await this.metadataRepo.getByHash(orgRef, hash);
        if (pinned?.body) {
          // Use the pinned body for the definition; pull identity/state
          // fields from the current projection if available so display
          // labels and active-flag stay fresh. Synthesize if absent.
          const current = await this.getProcess(req.process_name, context);
          const body: any = pinned.body;
          return {
            id: current?.id ?? `pinned_${hash.slice(7, 19)}`,
            name: req.process_name,
            label: body.label ?? current?.label ?? req.process_name,
            object_name: req.object_name,
            description: body.description ?? current?.description,
            active: current?.active ?? true,
            definition: body,
            created_at: current?.created_at,
            updated_at: current?.updated_at,
          };
        }
        this.logger?.warn?.('[approvals] pinned process body not found; falling back to current', {
          request: req.id, process: req.process_name, hash,
        });
      } catch (err: any) {
        this.logger?.warn?.('[approvals] getByHash failed; falling back to current', {
          request: req.id, error: err?.message,
        });
      }
    }
    return this.getProcess(req.process_name, context);
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
    const ctxOrg = (context as any)?.organizationId ?? (context as any)?.tenantId ?? null;
    const approvers = await this.expandApprovers(step0, input.payload, ctxOrg);

    const now = this.clock.now().toISOString();
    const id = uid('areq');
    const processHash = await this.resolveProcessHash(process.name, ctxOrg);
    const row: any = {
      id,
      process_name: process.name,
      process_hash: processHash,
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

    const process = await this.loadProcessForRequest(req, context);
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
      const original = await this.expandApprovers(step, req.payload, (req as any).organization_id ?? null);
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
    const nextApprovers = await this.expandApprovers(nextStep, req.payload, (req as any).organization_id ?? null);
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

    const process = await this.loadProcessForRequest(req, context);
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
      const prevApprovers = await this.expandApprovers(prev, req.payload, (req as any).organization_id ?? null);
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
    const process = await this.loadProcessForRequest(req, context);
    if (process) {
      await this.syncStatusField(process, fresh!);
      await this.runActions((process.definition as any)?.onRecall, 'recall', process, fresh!, undefined, input.actorId, input.comment);
    }
    return { request: fresh!, finalized: true };
  }

  // ── ADR-0019: Approval-as-flow-node ──────────────────────────
  //
  // A flow's Approval node opens a request via `openNodeRequest` (carrying its
  // own approvers/behavior config and the suspended run id), then suspends. A
  // later `decideNode` finalizes it; the node provider resumes the flow run
  // down the matching `approve`/`reject` edge. These reuse the same approver
  // expansion, audit rows, lock (the beforeUpdate hook keys on a *pending*
  // request, so finalizing auto-releases it), and status mirror as the
  // process-driven path — only the trigger and continuation differ.

  /** Mirror a request status onto a business-object field, if configured. */
  private async mirrorStatusField(object: string, recordId: string, field: string, status: string): Promise<void> {
    try {
      await this.engine.update(object, { id: recordId, [field]: status }, { context: SYSTEM_CTX });
    } catch (err: any) {
      this.logger?.warn?.(`[approvals] mirrorStatusField failed: ${err?.message ?? err}`);
    }
  }

  /**
   * Open a pending approval request on behalf of a flow's Approval node
   * (ADR-0019). Self-contained: the node config (approvers/behavior/status
   * field) is snapshotted on the row, since a node-driven request has no
   * `sys_approval_process` to resolve against.
   */
  async openNodeRequest(
    input: {
      object: string;
      recordId: string;
      runId: string;
      nodeId: string;
      config: ApprovalNodeConfig;
      flowName?: string;
      submitterId?: string | null;
      record?: any;
      organizationId?: string | null;
    },
    context: SharingExecutionContext,
  ): Promise<ApprovalRequestRow> {
    if (!input.object) throw new Error('VALIDATION_FAILED: object is required');
    if (!input.recordId) throw new Error('VALIDATION_FAILED: recordId is required');
    if (!input.runId) throw new Error('VALIDATION_FAILED: runId is required');

    // One pending request per (object, record) — same guard as submit().
    const existing = await this.engine.find('sys_approval_request', {
      where: { object_name: input.object, record_id: input.recordId, status: 'pending' },
      limit: 1, context: SYSTEM_CTX,
    });
    if (Array.isArray(existing) && existing[0]) {
      throw new Error(`DUPLICATE_REQUEST: a pending approval already exists for ${input.object}/${input.recordId}`);
    }

    const ctxOrg = (context as any)?.organizationId ?? (context as any)?.tenantId ?? input.organizationId ?? null;
    const approvers = await this.expandApprovers({ approvers: input.config.approvers }, input.record, ctxOrg);

    const now = this.clock.now().toISOString();
    const id = uid('areq');
    const processName = `flow:${input.flowName ?? input.nodeId}`;
    const row: any = {
      id,
      process_name: processName,
      object_name: input.object,
      record_id: input.recordId,
      submitter_id: input.submitterId ?? context.userId ?? null,
      status: 'pending',
      current_step: input.nodeId,
      current_step_index: 0,
      pending_approvers: approvers.join(','),
      payload_json: input.record != null ? JSON.stringify(input.record) : null,
      flow_run_id: input.runId,
      flow_node_id: input.nodeId,
      node_config_json: JSON.stringify(input.config),
      organization_id: ctxOrg,
      created_at: now,
      updated_at: now,
    };
    await this.engine.insert('sys_approval_request', row, { context: SYSTEM_CTX });
    await this.engine.insert('sys_approval_action', {
      id: uid('aact'), request_id: id, organization_id: ctxOrg,
      step_name: input.nodeId, step_index: 0, action: 'submit',
      actor_id: input.submitterId ?? context.userId ?? null, comment: null, created_at: now,
    }, { context: SYSTEM_CTX });

    if (input.config.lockRecord !== false) {
      // Lock is enforced by the existing beforeUpdate hook keyed on a pending
      // request; no extra write needed here.
    }
    if (input.config.approvalStatusField) {
      await this.mirrorStatusField(input.object, input.recordId, input.config.approvalStatusField, 'pending');
    }

    return rowFromRequest(row);
  }

  /**
   * Record a decision on a node-driven request (ADR-0019). Honours the node's
   * `unanimous` behavior (holds until every approver has approved). When the
   * request finalizes, returns the suspended run id + node id so the node
   * provider can resume the flow down the matching branch.
   */
  async decideNode(
    requestId: string,
    input: { decision: 'approve' | 'reject'; actorId: string; comment?: string },
    context: SharingExecutionContext,
  ): Promise<{ request: ApprovalRequestRow; runId: string | null; nodeId: string | null; finalized: boolean; decision: 'approve' | 'reject' }> {
    if (!requestId) throw new Error('VALIDATION_FAILED: requestId is required');
    if (!input?.actorId) throw new Error('VALIDATION_FAILED: actorId is required');
    if (input.decision !== 'approve' && input.decision !== 'reject') {
      throw new Error('VALIDATION_FAILED: decision must be approve|reject');
    }

    // Read the raw row to reach flow_* correlation + the node config snapshot.
    const rawRows = await this.engine.find('sys_approval_request', {
      where: { id: requestId }, limit: 1, context: SYSTEM_CTX,
    });
    const raw: any = Array.isArray(rawRows) ? rawRows[0] : null;
    if (!raw) throw new Error(`REQUEST_NOT_FOUND: ${requestId}`);
    if (raw.status !== 'pending') throw new Error(`INVALID_STATE: request is ${raw.status}`);

    const pendingApprovers = csvSplit(raw.pending_approvers);
    if (!context.isSystem && !pendingApprovers.includes(input.actorId)) {
      throw new Error(`FORBIDDEN: actor '${input.actorId}' is not a pending approver`);
    }

    const config = parseJson<ApprovalNodeConfig>(raw.node_config_json, { approvers: [], behavior: 'first_response' } as any);
    const org = raw.organization_id ?? null;
    const nodeId: string | null = raw.flow_node_id ?? raw.current_step ?? null;
    const runId: string | null = raw.flow_run_id ?? null;
    const now = this.clock.now().toISOString();

    // Audit the decision first so the unanimous tally below sees it.
    await this.engine.insert('sys_approval_action', {
      id: uid('aact'), request_id: requestId, organization_id: org,
      step_name: nodeId, step_index: 0, action: input.decision,
      actor_id: input.actorId, comment: input.comment ?? null, created_at: now,
    }, { context: SYSTEM_CTX });

    // Unanimous approve: advance only once every approver has approved.
    if (input.decision === 'approve' && config.behavior === 'unanimous') {
      const original = await this.expandApprovers(
        { approvers: config.approvers }, parseJson(raw.payload_json, undefined), org,
      );
      const acts = await this.engine.find('sys_approval_action', {
        where: { request_id: requestId, step_index: 0, action: 'approve' }, limit: 500, context: SYSTEM_CTX,
      });
      const approved = new Set<string>((acts ?? []).map((a: any) => String(a.actor_id ?? '')).filter(Boolean));
      const stillPending = original.filter(a => !approved.has(a));
      if (stillPending.length > 0) {
        await this.engine.update('sys_approval_request', {
          id: requestId, pending_approvers: stillPending.join(','), updated_at: now,
        }, { context: SYSTEM_CTX });
        const fresh = await this.getRequest(requestId, context);
        return { request: fresh!, runId, nodeId, finalized: false, decision: input.decision };
      }
    }

    const finalStatus = input.decision === 'approve' ? 'approved' : 'rejected';
    await this.engine.update('sys_approval_request', {
      id: requestId, status: finalStatus, pending_approvers: null, completed_at: now, updated_at: now,
    }, { context: SYSTEM_CTX });
    if (config.approvalStatusField) {
      await this.mirrorStatusField(raw.object_name, raw.record_id, config.approvalStatusField, finalStatus);
    }
    const fresh = await this.getRequest(requestId, context);
    return { request: fresh!, runId, nodeId, finalized: true, decision: input.decision };
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
