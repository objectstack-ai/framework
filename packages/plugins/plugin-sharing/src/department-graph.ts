// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { IDepartmentGraphService } from '@objectstack/spec/contracts';
import type { SharingEngine } from './sharing-service.js';
import { TeamGraphService } from './team-graph.js';

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

type DeptCache = {
  descendants?: Map<string, string[]>;
  expandUsers?: Map<string, string[]>;
  head?: Map<string, string | null>;
};

export interface DepartmentGraphOptions {
  engine: SharingEngine;
  /** Optional tenant scope; null means cross-tenant lookups. */
  organizationId?: string | null;
  /** Optional shared cache across one evaluator pass. */
  cache?: DeptCache;
  /**
   * Optional team-graph instance to share role / manager lookups with —
   * department graph proxies `managerOf` through so callers only need one
   * service.
   */
  teamGraph?: TeamGraphService;
}

/**
 * Default {@link IDepartmentGraphService} implementation.
 *
 * Walks `sys_department.parent_department_id` for hierarchy and
 * `sys_department_member` for member expansion. Treats the optional
 * `active` flag as a hard filter (inactive departments contribute no
 * members and stop BFS descent into their subtrees).
 *
 * Reuses {@link TeamGraphService.managerOf} for user-level manager
 * lookup so callers can use this single service in approval / sharing
 * pipelines.
 */
export class DepartmentGraphService implements IDepartmentGraphService {
  private readonly engine: SharingEngine;
  private readonly organizationId: string | null;
  private readonly cache: DeptCache;
  private readonly teamGraph?: TeamGraphService;

  constructor(opts: DepartmentGraphOptions) {
    this.engine = opts.engine;
    this.organizationId = opts.organizationId ?? null;
    this.cache = opts.cache ?? {};
    this.cache.descendants ??= new Map();
    this.cache.expandUsers ??= new Map();
    this.cache.head ??= new Map();
    this.teamGraph = opts.teamGraph;
  }

  async descendants(departmentId: string): Promise<string[]> {
    if (!departmentId) return [];
    const cached = this.cache.descendants!.get(departmentId);
    if (cached) return cached;

    // Verify seed itself is active + within tenant scope.
    let seedActive = true;
    try {
      const seedRows = await this.engine.find('sys_department', {
        filter: this.orgScope({ id: departmentId }),
        fields: ['id', 'active'],
        limit: 1,
        context: SYSTEM_CTX,
      });
      const seedRow: any = Array.isArray(seedRows) ? seedRows[0] : null;
      if (!seedRow) seedActive = false;
      else if (seedRow.active === false) seedActive = false;
    } catch {
      seedActive = false;
    }
    if (!seedActive) {
      this.cache.descendants!.set(departmentId, []);
      return [];
    }

    const seen = new Set<string>([departmentId]);
    const queue: string[] = [departmentId];
    while (queue.length) {
      const parent = queue.shift()!;
      let children: any[] = [];
      try {
        children = await this.engine.find('sys_department', {
          filter: this.orgScope({ parent_department_id: parent, active: { $ne: false } }),
          fields: ['id'],
          limit: 1000,
          context: SYSTEM_CTX,
        });
      } catch {
        children = [];
      }
      for (const c of children ?? []) {
        const cid = String((c as any).id ?? '');
        if (cid && !seen.has(cid)) {
          seen.add(cid);
          queue.push(cid);
        }
      }
    }
    const out = Array.from(seen);
    this.cache.descendants!.set(departmentId, out);
    return out;
  }

  async expandUsers(departmentId: string): Promise<string[]> {
    if (!departmentId) return [];
    const cached = this.cache.expandUsers!.get(departmentId);
    if (cached) return cached;

    const depts = await this.descendants(departmentId);
    if (depts.length === 0) return [];

    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_department_member', {
        filter: { department_id: { $in: depts } },
        fields: ['user_id'],
        limit: 10000,
        context: SYSTEM_CTX,
      });
    } catch {
      rows = [];
    }
    const users = Array.from(
      new Set((rows ?? []).map((r: any) => String(r.user_id ?? '')).filter(Boolean)),
    );
    this.cache.expandUsers!.set(departmentId, users);
    return users;
  }

  async headOf(departmentId: string): Promise<string | null> {
    if (!departmentId) return null;
    if (this.cache.head!.has(departmentId)) return this.cache.head!.get(departmentId) ?? null;
    let row: any = null;
    try {
      const rows = await this.engine.find('sys_department', {
        filter: { id: departmentId },
        fields: ['id', 'manager_user_id'],
        limit: 1,
        context: SYSTEM_CTX,
      });
      row = Array.isArray(rows) ? rows[0] : null;
    } catch {
      row = null;
    }
    const head = row?.manager_user_id ? String(row.manager_user_id) : null;
    this.cache.head!.set(departmentId, head);
    return head;
  }

  async managerOf(userId: string, organizationId?: string): Promise<string | null> {
    if (this.teamGraph) return this.teamGraph.managerOf(userId, organizationId);
    // Standalone fallback: read sys_user.manager_id directly.
    if (!userId) return null;
    try {
      const rows = await this.engine.find('sys_user', {
        filter: { id: userId },
        fields: ['id', 'manager_id'],
        limit: 1,
        context: SYSTEM_CTX,
      });
      const row: any = Array.isArray(rows) ? rows[0] : null;
      return row?.manager_id ? String(row.manager_id) : null;
    } catch {
      return null;
    }
  }

  private orgScope(filter: Record<string, unknown>): Record<string, unknown> {
    if (this.organizationId) return { ...filter, organization_id: this.organizationId };
    return filter;
  }
}
