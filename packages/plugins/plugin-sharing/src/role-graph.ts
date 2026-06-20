// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { SharingEngine } from './sharing-service.js';
import { TeamGraphService } from './team-graph.js';

const SYSTEM_CTX = { isSystem: true, roles: [], permissions: [] } as const;

type RoleCache = {
  descendants?: Map<string, string[]>;
  expand?: Map<string, string[]>;
};

export interface RoleGraphOptions {
  engine: SharingEngine;
  /** Optional tenant scope; null means cross-tenant lookups. */
  organizationId?: string | null;
  /** Optional shared cache across one evaluator pass. */
  cache?: RoleCache;
  /** Reused for role → direct-member-user expansion (sys_member.role). */
  teamGraph?: TeamGraphService;
}

/**
 * Role hierarchy graph (ADR-0056 D6).
 *
 * Walks `sys_role.parent` to resolve a role's SUBORDINATE roles, powering the
 * declarative `role_and_subordinates` sharing-rule recipient — Salesforce-style
 * "grant access using the role hierarchy", expressed per sharing rule rather
 * than hardcoded. A role's `parent` is its manager role, so the subordinates of
 * `R` are every role whose ancestor chain passes through `R`.
 *
 * All lookups elevate to a system context (the hierarchy is platform metadata);
 * callers own their own authorization. Cycles are guarded by a visited set.
 */
export class RoleGraphService {
  private readonly engine: SharingEngine;
  private readonly organizationId: string | null;
  private readonly cache: RoleCache;
  private readonly teamGraph: TeamGraphService;

  constructor(opts: RoleGraphOptions) {
    this.engine = opts.engine;
    this.organizationId = opts.organizationId ?? null;
    this.cache = opts.cache ?? {};
    this.cache.descendants ??= new Map();
    this.cache.expand ??= new Map();
    this.teamGraph =
      opts.teamGraph ?? new TeamGraphService({ engine: this.engine, organizationId: this.organizationId });
  }

  /** Direct child roles of `roleName` (`sys_role.parent === roleName`). */
  private async childRoles(roleName: string): Promise<string[]> {
    const filter: Record<string, unknown> = { parent: roleName };
    if (this.organizationId) filter.organization_id = this.organizationId;
    let rows: any[] = [];
    try {
      rows = await this.engine.find('sys_role', {
        filter,
        fields: ['name'],
        limit: 5000,
        context: SYSTEM_CTX,
      });
    } catch {
      rows = [];
    }
    return Array.from(new Set((rows ?? []).map((r: any) => String(r.name ?? '')).filter(Boolean)));
  }

  /** `roleName` plus every role beneath it in the hierarchy (BFS, cycle-safe). */
  async descendantRoles(roleName: string): Promise<string[]> {
    if (!roleName) return [];
    const cached = this.cache.descendants!.get(roleName);
    if (cached) return cached;
    const out: string[] = [];
    const seen = new Set<string>();
    const queue: string[] = [roleName];
    while (queue.length) {
      const r = queue.shift()!;
      if (seen.has(r)) continue;
      seen.add(r);
      out.push(r);
      for (const child of await this.childRoles(r)) {
        if (!seen.has(child)) queue.push(child);
      }
    }
    this.cache.descendants!.set(roleName, out);
    return out;
  }

  /** Users holding `roleName` OR any subordinate role (the `role_and_subordinates` set). */
  async expandRoleAndSubordinates(roleName: string, organizationId?: string): Promise<string[]> {
    if (!roleName) return [];
    const org = organizationId ?? this.organizationId ?? '*';
    const key = `${org}::${roleName}`;
    const cached = this.cache.expand!.get(key);
    if (cached) return cached;
    const roles = await this.descendantRoles(roleName);
    const users = new Set<string>();
    for (const role of roles) {
      for (const uid of await this.teamGraph.expandRoleUsers(role, organizationId ?? this.organizationId ?? undefined)) {
        users.add(uid);
      }
    }
    const result = Array.from(users);
    this.cache.expand!.set(key, result);
    return result;
  }
}
