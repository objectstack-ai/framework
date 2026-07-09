// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import type { SharingEngine } from './sharing-service.js';
import { TeamGraphService } from './team-graph.js';

const SYSTEM_CTX = { isSystem: true, positions: [], permissions: [] } as const;

type PositionCache = {
  expand?: Map<string, string[]>;
};

export interface PositionGraphOptions {
  engine: SharingEngine;
  /** Optional tenant scope; null means cross-tenant lookups. */
  organizationId?: string | null;
  /** Optional shared cache across one evaluator pass. */
  cache?: PositionCache;
  /** Reused for the better-auth membership expansion (sys_member.role). */
  teamGraph?: TeamGraphService;
}

/**
 * Position expansion (ADR-0090 D3).
 *
 * Positions are FLAT capability-distribution groups — there is no hierarchy
 * to walk (the org tree lives on `sys_business_unit`; the former
 * position-parent walk queried a column that never existed, ADR-0057 D5).
 * The one job left here is resolving "who holds position P":
 *
 *   1. `sys_user_position` — the platform-owned source of truth
 *      (ADR-0057 D4), keyed by the position's machine name;
 *   2. ∪ `sys_member.role` — the better-auth membership string, kept as a
 *      transition source (ADR-0057 D4 addendum) via {@link TeamGraphService}.
 *
 * All lookups elevate to a system context (assignments are platform
 * metadata); callers own their own authorization.
 */
export class PositionGraphService {
  private readonly engine: SharingEngine;
  private readonly organizationId: string | null;
  private readonly cache: PositionCache;
  private readonly teamGraph: TeamGraphService;

  constructor(opts: PositionGraphOptions) {
    this.engine = opts.engine;
    this.organizationId = opts.organizationId ?? null;
    this.cache = opts.cache ?? {};
    this.cache.expand ??= new Map();
    this.teamGraph =
      opts.teamGraph ?? new TeamGraphService({ engine: this.engine, organizationId: this.organizationId });
  }

  /** Users holding `positionName` (assignment table ∪ membership transition source). */
  async expandPositionUsers(positionName: string, organizationId?: string): Promise<string[]> {
    if (!positionName) return [];
    const org = organizationId ?? this.organizationId ?? '*';
    const key = `${org}::${positionName}`;
    const cached = this.cache.expand!.get(key);
    if (cached) return cached;

    const users = new Set<string>();

    // 1) Platform assignment table (source of truth).
    const filter: Record<string, unknown> = { position: positionName };
    const scopeOrg = organizationId ?? this.organizationId;
    if (scopeOrg) filter.organization_id = scopeOrg;
    try {
      const rows = await this.engine.find('sys_user_position', {
        filter,
        fields: ['user_id'],
        limit: 10000,
        context: SYSTEM_CTX,
      });
      for (const r of (rows ?? []) as any[]) {
        const uid = String(r.user_id ?? '');
        if (uid) users.add(uid);
      }
    } catch {
      /* table may not exist on minimal stacks — union source below still applies */
    }

    // 2) better-auth membership string (transition window, ADR-0057 D4).
    for (const uid of await this.teamGraph.expandRoleUsers(positionName, scopeOrg ?? undefined)) {
      users.add(uid);
    }

    const result = Array.from(users);
    this.cache.expand!.set(key, result);
    return result;
  }
}
