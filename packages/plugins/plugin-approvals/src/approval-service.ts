// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import {
  APPROVAL_BRANCH_LABELS,
  type ApprovalNodeConfig,
} from '@objectstack/spec/automation';
import type {
  IApprovalService,
  ApprovalRequestRow,
  ApprovalActionRow,
  ApprovalDecisionInput,
  ApprovalDecisionResult,
  ApprovalStatus,
  SharingExecutionContext,
} from '@objectstack/spec/contracts';

/**
 * Node-era approval runtime (ADR-0019).
 *
 * Approval is no longer a standalone engine — it is a **flow node**. A flow's
 * Approval node opens a request via {@link ApprovalService.openNodeRequest} and
 * the run suspends; a human decision via {@link ApprovalService.decide}
 * finalises the request and resumes the owning run down the matching
 * `approve` / `reject` edge.
 *
 * This service owns the durable approval *state* — `sys_approval_request` /
 * `sys_approval_action`, approver resolution (team / department / role /
 * manager graph), and the optional status-field mirror — plus the decision
 * API. It does not author processes, submit, or walk multi-step machinery
 * anymore; that orchestration lives on the one automation engine.
 */
export interface ApprovalEngine {
  find(object: string, options?: any): Promise<any[]>;
  insert(object: string, data: any, options?: any): Promise<any>;
  update(object: string, idOrData: any, dataOrOptions?: any, options?: any): Promise<any>;
  delete(object: string, options?: any): Promise<any>;
}

export interface ApprovalClock { now(): Date }

/**
 * Minimal automation surface the service uses to resume a suspended flow run
 * once a decision finalises a node-driven request. Optional — attached by the
 * plugin when an automation engine is present (see `approval-node.ts`).
 */
export interface ApprovalResumeSurface {
  resume?(runId: string, signal?: { output?: Record<string, unknown>; branchLabel?: string }): Promise<unknown>;
}

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
    flow_run_id: row.flow_run_id ?? undefined,
    flow_node_id: row.flow_node_id ?? undefined,
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

export interface ApprovalServiceOptions {
  engine: ApprovalEngine;
  clock?: ApprovalClock;
  logger?: { info?: (msg: any, ...rest: any[]) => void; warn?: (msg: any, ...rest: any[]) => void; error?: (msg: any, ...rest: any[]) => void; debug?: (msg: any, ...rest: any[]) => void };
  /**
   * Optional automation surface used to resume a suspended flow run when a
   * decision finalises a request. Usually attached after construction via
   * {@link ApprovalService.attachAutomation} once the automation engine is
   * available.
   */
  automation?: ApprovalResumeSurface;
}

export class ApprovalService implements IApprovalService {
  private readonly engine: ApprovalEngine;
  private readonly clock: ApprovalClock;
  private readonly logger?: ApprovalServiceOptions['logger'];
  private automation?: ApprovalResumeSurface;

  constructor(opts: ApprovalServiceOptions) {
    this.engine = opts.engine;
    this.clock = opts.clock ?? { now: () => new Date() };
    this.logger = opts.logger;
    this.automation = opts.automation;
  }

  /** Attach (or replace) the automation surface used to resume flow runs. */
  attachAutomation(automation: ApprovalResumeSurface): void {
    this.automation = automation;
  }

  /**
   * Expand the approvers on an Approval node into user IDs by querying the
   * graph tables for `team:` / `department:` / `role:` / `manager:` approver
   * types. Falls back to a prefixed literal (`type:value`) when graph lookups
   * produce nothing — so existing fixtures and flows that rely on substring
   * matching keep working.
   *
   * **Graph semantics:**
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

  /** Mirror a request status onto a business-object field, if configured. */
  private async mirrorStatusField(object: string, recordId: string, field: string, status: string): Promise<void> {
    try {
      await this.engine.update(object, { id: recordId, [field]: status }, { context: SYSTEM_CTX });
    } catch (err: any) {
      this.logger?.warn?.(`[approvals] mirrorStatusField failed: ${err?.message ?? err}`);
    }
  }

  // ── ADR-0019: Approval-as-flow-node ──────────────────────────
  //
  // A flow's Approval node opens a request via `openNodeRequest` (carrying its
  // own approvers/behavior config and the suspended run id), then suspends. A
  // later `decide` finalizes it and resumes the flow run down the matching
  // `approve`/`reject` edge. The record lock is enforced by a beforeUpdate hook
  // keyed on a *pending* request, so finalizing auto-releases it.

  /**
   * Open a pending approval request on behalf of a flow's Approval node. The
   * node config (approvers / behavior / status field) is snapshotted on the row
   * so a decision can be made without any process to resolve against.
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

    // One pending request per (object, record).
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

    // Record lock (when `lockRecord !== false`) is enforced by the beforeUpdate
    // hook keyed on the now-pending request; no extra write needed here.
    if (input.config.approvalStatusField) {
      await this.mirrorStatusField(input.object, input.recordId, input.config.approvalStatusField, 'pending');
    }

    return rowFromRequest(row);
  }

  /**
   * Record a decision on a node-driven request. Honours the node's `unanimous`
   * behavior (holds until every approver has approved). When the request
   * finalizes, returns the suspended run id + node id so the caller (or
   * {@link ApprovalService.decide}) can resume the flow down the matching
   * branch.
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

  /**
   * Public contract entrypoint (ADR-0019). Records a decision on a node-driven
   * request via {@link ApprovalService.decideNode} and, when it finalizes,
   * resumes the owning flow run down the matching `approve` / `reject` edge.
   */
  async decide(
    requestId: string,
    input: ApprovalDecisionInput,
    context: SharingExecutionContext,
  ): Promise<ApprovalDecisionResult> {
    const result = await this.decideNode(requestId, input, context);

    let resumed = false;
    if (result.finalized && result.runId && typeof this.automation?.resume === 'function') {
      const branchLabel = result.decision === 'approve'
        ? APPROVAL_BRANCH_LABELS.approve
        : APPROVAL_BRANCH_LABELS.reject;
      try {
        await this.automation.resume(result.runId, {
          branchLabel,
          output: { decision: result.decision, requestId },
        });
        resumed = true;
      } catch (err: any) {
        this.logger?.warn?.('[approvals] resume after decision failed', {
          request: requestId, run: result.runId, error: err?.message ?? String(err),
        });
      }
    }

    return {
      request: result.request,
      finalized: result.finalized,
      decision: result.decision,
      runId: result.runId,
      resumed,
    };
  }

  // ── Read API ─────────────────────────────────────────────────

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
