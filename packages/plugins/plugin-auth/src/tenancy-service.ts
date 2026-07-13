// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `tenancy` service — the single source of truth for "what tenancy mode is this
 * deployment in?" (ADR-0093 D4).
 *
 * Before this service, the same fact was re-derived from four independent
 * signals that could disagree: the `OS_MULTI_ORG_ENABLED` env flag, the
 * `org-scoping` service probe, `sys_organization` row counting, and the
 * frontend feature flags. The worst disagreement was silent — requesting
 * multi-org without the enterprise `@objectstack/organizations` package degrades
 * to zero tenant isolation with only a console warning (an ADR-0049-class
 * unenforced security property). This service makes the two facts that matter —
 * what was *requested* and what is *actually active* — first-class and
 * queryable, so consumers stop re-deriving and the degraded state stops being
 * silent.
 *
 * Registered by plugin-auth (the open-core home, alongside the default-org
 * bootstrap). The baseline implementation derives `isolationActive` from the
 * presence of the `org-scoping` service — the exact signal SecurityPlugin
 * probes today — so the enterprise package needs no change to light it up:
 * installing `@objectstack/organizations` registers `org-scoping`, and this
 * service reports `mode: 'multi'` / `isolationActive: true` as a result.
 */

export type TenancyMode = 'single' | 'multi';

export interface TenancyService {
  /**
   * Resolved tenancy mode. `multi` iff org-scoping (auto-stamp + tenant RLS) is
   * actually active; otherwise `single`. A *degraded* deployment (multi-org
   * requested, isolation absent) reports `single` — it behaves single-org-like
   * because nothing isolates its data.
   */
  readonly mode: TenancyMode;
  /** True iff org-scoping (auto-stamp + tenant RLS) is actually wired. */
  readonly isolationActive: boolean;
  /** What the operator asked for (`OS_MULTI_ORG_ENABLED`). */
  readonly requested: boolean;
  /**
   * `requested && !isolationActive` — multi-org was asked for but cannot be
   * enforced. Boot is refused unless `OS_ALLOW_DEGRADED_TENANCY=1` (serve.ts,
   * ADR-0093 D5); when it boots anyway, this flag brands the deployment
   * everywhere an operator looks (`/auth/config`, Setup dashboard).
   */
  readonly degraded: boolean;
  /**
   * The default organization id to bind new users to in `single` mode
   * (ADR-0093 D3). Returns `null` in `multi` mode — the framework never guesses
   * a target org there; invite / add-member / SSO JIT own membership. Also
   * `null` in single mode until an org exists (e.g. before the default-org
   * bootstrap runs). Positive resolutions are memoized (the id is stable).
   */
  defaultOrgId(): Promise<string | null>;
}

export interface TenancyServiceDeps {
  /** `OS_MULTI_ORG_ENABLED` — what the operator asked for. */
  requested: boolean;
  /**
   * Whether org-scoping is actually wired. Called lazily (never at
   * construction — the org-scoping provider registers after plugin-auth) and
   * cheap (a service-registry lookup); consumers that read it hot should cache
   * the result themselves, as SecurityPlugin does at `start()`.
   */
  probeIsolation: () => boolean;
  /** ObjectQL engine accessor, for {@link TenancyService.defaultOrgId}. */
  getEngine?: () => unknown | undefined;
  logger?: { info?: (msg: string, meta?: any) => void; warn?: (msg: string, meta?: any) => void };
}

const SYSTEM_CTX = { isSystem: true };

async function findRows(
  engine: any,
  object: string,
  where: Record<string, unknown>,
  limit: number,
): Promise<any[]> {
  if (!engine || typeof engine.find !== 'function') return [];
  try {
    const rows = await engine.find(object, { where, limit }, { context: SYSTEM_CTX });
    return Array.isArray(rows) ? rows : Array.isArray(rows?.records) ? rows.records : [];
  } catch {
    return [];
  }
}

/**
 * Resolve the single-org default organization: prefer the stable `slug='default'`
 * bootstrap org, else the sole org row when exactly one exists. Returns `null`
 * when there is no unambiguous single org (none yet, or ≥2 — the latter is a
 * multi-org shape and this should not have been called).
 */
export async function resolveDefaultOrgId(engine: any): Promise<string | null> {
  const bySlug = await findRows(engine, 'sys_organization', { slug: 'default' }, 1);
  if (bySlug[0]?.id) return String(bySlug[0].id);
  const any = await findRows(engine, 'sys_organization', {}, 2);
  if (any.length === 1 && any[0]?.id) return String(any[0].id);
  return null;
}

export function createTenancyService(deps: TenancyServiceDeps): TenancyService {
  let cachedDefaultOrgId: string | null = null;

  const isolationActive = (): boolean => {
    try {
      return !!deps.probeIsolation();
    } catch {
      return false;
    }
  };

  return {
    get requested(): boolean {
      return deps.requested;
    },
    get isolationActive(): boolean {
      return isolationActive();
    },
    get mode(): TenancyMode {
      return isolationActive() ? 'multi' : 'single';
    },
    get degraded(): boolean {
      return deps.requested && !isolationActive();
    },
    async defaultOrgId(): Promise<string | null> {
      // Multi-org: the framework never guesses a target org.
      if (isolationActive()) return null;
      if (cachedDefaultOrgId) return cachedDefaultOrgId;
      const resolved = await resolveDefaultOrgId(deps.getEngine?.());
      // Memoize only a positive resolution — a null (org not bootstrapped yet)
      // must re-resolve on the next call.
      if (resolved) cachedDefaultOrgId = resolved;
      return resolved;
    },
  };
}
