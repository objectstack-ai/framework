// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { ITeamGraphService } from '@objectstack/spec/contracts';
import type { SharingEngine } from './sharing-service.js';

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

/**
 * Cache key for a team-graph lookup. Per-tenant when an org is in scope
 * (rules are tenant-scoped) — but we don't cache long-term in v1 since
 * `sys_team_member` rows mutate freely; we just memoise within a single
 * evaluation pass.
 */
type Cache = {
  descendants?: Map<string, string[]>;
  expandUsers?: Map<string, string[]>;
  expandRole?: Map<string, string[]>;
  manager?: Map<string, string | null>;
};

export interface TeamGraphOptions {
  engine: SharingEngine;
  /** Optional tenant scope; null means cross-tenant lookups. */
  organizationId?: string | null;
  /** Optional shared cache across one evaluator pass. */
  cache?: Cache;
}

/**
 * Default {@link ITeamGraphService} implementation backed by
 * `sys_team` (with `parent_team_id` for hierarchy) and
 * `sys_team_member` plus `sys_member.role` for role expansion.
 *
 * All queries elevate to {@link SYSTEM_CTX} since the graph is platform
 * metadata — callers (sharing rule evaluator, approval engine) own their
 * own enforcement.
 */
export class TeamGraphService implements ITeamGraphService {
  private readonly engine: SharingEngine;
  private readonly organizationId: string | null;
  private readonly cache: Cache;

  constructor(opts: TeamGraphOptions) {
    this.engine = opts.engine;
    this.organizationId = opts.organizationId ?? null;
    this.cache = opts.cache ?? {};
    this.cache.descendants ??= new Map();
    this.cache.expandUsers ??= new Map();
    this.cache.expandRole ??= new Map();
    this.cache.manager ??= new Map();
  }

  async descendants(teamId: string): Promise<string[]> {
    if (!teamId) return [];
    const cached = this.cache.descendants!.get(teamId);
    if (cached) return cached;

    const seen = new Set<string>([teamId]);
    const queue: string[] = [teamId];
    while (queue.length) {
      const parent = queue.shift()!;
      let children: any[] = [];
      try {
        children = await this.engine.find('sys_team', {
          filter: this.orgScope({ parent_team_id: parent }),
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
    this.cache.descendants!.set(teamId, out);
    return out;
  }

  async expandUsers(teamId: string): Promise<string[]> {
    if (!teamId) return [];
    const cached = this.cache.expandUsers!.get(teamId);
    if (cached) return cached;

    const teams = await this.descendants(teamId);
    if (teams.length === 0) return [];
    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_team_member', {
        filter: { team_id: { $in: teams } },
        fields: ['user_id'],
        limit: 10000,
        context: SYSTEM_CTX,
      });
    } catch {
      rows = [];
    }
    const users = Array.from(new Set((rows ?? []).map((r: any) => String(r.user_id ?? '')).filter(Boolean)));
    this.cache.expandUsers!.set(teamId, users);
    return users;
  }

  async expandRoleUsers(roleName: string, organizationId?: string): Promise<string[]> {
    if (!roleName) return [];
    const key = `${organizationId ?? this.organizationId ?? '*'}::${roleName}`;
    const cached = this.cache.expandRole!.get(key);
    if (cached) return cached;
    const filter: Record<string, unknown> = { role: roleName };
    const org = organizationId ?? this.organizationId;
    if (org) filter.organization_id = org;
    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_member', {
        filter,
        fields: ['user_id'],
        limit: 10000,
        context: SYSTEM_CTX,
      });
    } catch {
      rows = [];
    }
    const users = Array.from(new Set((rows ?? []).map((r: any) => String(r.user_id ?? '')).filter(Boolean)));
    this.cache.expandRole!.set(key, users);
    return users;
  }

  async managerOf(userId: string, _organizationId?: string): Promise<string | null> {
    if (!userId) return null;
    if (this.cache.manager!.has(userId)) return this.cache.manager!.get(userId) ?? null;
    let row: any = null;
    try {
      const rows = await this.engine.find('sys_user', {
        filter: { id: userId },
        fields: ['id', 'manager_id'],
        limit: 1,
        context: SYSTEM_CTX,
      });
      row = Array.isArray(rows) ? rows[0] : null;
    } catch {
      row = null;
    }
    const mgr = row?.manager_id ? String(row.manager_id) : null;
    this.cache.manager!.set(userId, mgr);
    return mgr;
  }

  /**
   * Expand an approver / recipient descriptor of the form
   * `{type, value}` into a flat list of user IDs by walking the graph.
   * Unknown types echo `${type}:${value}` so existing storage formats
   * stay compatible.
   */
  async expandPrincipal(
    input: { type: string; value: string; record?: any },
  ): Promise<string[]> {
    const t = input.type;
    const v = String(input.value ?? '');
    if (!v) return [];
    if (t === 'user') return [v];
    if (t === 'team') return this.expandUsers(v);
    if (t === 'role') return this.expandRoleUsers(v);
    if (t === 'field' && input.record) {
      const fv = (input.record as any)[v];
      return fv ? [String(fv)] : [];
    }
    if (t === 'manager' && input.record) {
      const subject = (input.record as any)[v] ?? (input.record as any).owner_id;
      if (!subject) return [];
      const mgr = await this.managerOf(String(subject));
      return mgr ? [mgr] : [];
    }
    // queue / unknown — fall back to raw prefix string so existing
    // string-match approver flows keep working.
    return [`${t}:${v}`];
  }

  private orgScope(filter: Record<string, unknown>): Record<string, unknown> {
    if (this.organizationId) return { ...filter, organization_id: this.organizationId };
    return filter;
  }
}
