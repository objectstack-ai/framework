// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ── The monotonic posture ladder (ADR-0095 D2/D3) ───────────────────────────
 *
 * The principal-tiering enum resolved ONCE in `resolveAuthzContext`
 * (`PLATFORM_ADMIN > TENANT_ADMIN > MEMBER > EXTERNAL`). This module owns two
 * things and deliberately nothing more:
 *
 *  1. **Derivation (D3).** {@link derivePosture} maps held *capability grants*
 *     — never a better-auth role — to a rung. `PLATFORM_ADMIN` derives from the
 *     unscoped `admin_full_access` grant (the `viewAllRecords`/`modifyAllRecords`
 *     evidence the superuser bypass already trusts); `TENANT_ADMIN` from the
 *     `organization_admin` grant. The better-auth `role='admin'` is upstream a
 *     *provisioning source* of those grants (`auto-org-admin-grant.ts`), so it
 *     never re-enters adjudication here — the #2836 dual-track class is closed
 *     by construction.
 *
 *  2. **The rung → injection-rule mapping + its tested invariants (D2).** Each
 *     rung maps to EXACTLY ONE row-visibility injection rule
 *     ({@link POSTURE_INJECTION_RULE}). {@link postureVisibleRows} is the
 *     REFERENCE MODEL of those rules over a synthetic row-set — it locks the two
 *     properties the ADR requires as invariants: strict nesting (rung n's
 *     visible set ⊇ rung n−1's) and the EXTERNAL deny-by-default semantics
 *     (explicit shares only, OWD never widens it).
 *
 * This module is NOT the enforcement path. The effective read/write filter is
 * `Layer0(tenant) AND Layer1(business RLS)`, computed in `@objectstack/plugin-
 * security` (`tenant-layer.ts` + `security-plugin.ts`), and the real behavior
 * guard is the `authz-matrix-gate` unit snapshot + the dogfood conformance
 * matrix. The reference model here exists so the ladder's *mathematical*
 * properties can be asserted at the unit layer without an enforcement boot, and
 * so the EXTERNAL rung — which has no enforcement path yet — cannot be
 * reinvented differently when portal/external membership arrives.
 */

import type { AuthzPosture } from '@objectstack/spec/security';

/**
 * The rung ordering, high privilege → low, matching the spec enum's numeric
 * values (`PLATFORM_ADMIN=3 … EXTERNAL=0`). Visibility grows monotonically UP
 * this ladder (see {@link postureVisibleRows}).
 */
export const POSTURE_LADDER = [
  'PLATFORM_ADMIN',
  'TENANT_ADMIN',
  'MEMBER',
  'EXTERNAL',
] as const satisfies readonly AuthzPosture[];

/** Numeric rank per rung (mirrors the spec `AuthzPosture` enum values). */
export const POSTURE_RANK: Record<AuthzPosture, number> = {
  PLATFORM_ADMIN: 3,
  TENANT_ADMIN: 2,
  MEMBER: 1,
  EXTERNAL: 0,
};

/**
 * The ONE row-visibility injection rule each rung maps to (ADR-0095 D2). Prose,
 * because the machine artifacts live in enforcement (Layer 0 + the per-rung
 * Layer 1 rule); this is the enumerable contract the explain track reports and
 * {@link postureVisibleRows} models.
 */
export const POSTURE_INJECTION_RULE: Record<AuthzPosture, string> = {
  PLATFORM_ADMIN:
    'Layer 0 exemption where the object posture permits (private / platform-global / better-auth-managed) — crosses the tenant wall; org-scoped like TENANT_ADMIN on ordinary tenant business objects.',
  TENANT_ADMIN:
    'All rows within the active organization (organization_id == ctx.tenantId); no ownership / depth / sharing narrowing.',
  MEMBER:
    'Business RLS within the organization — ownership (owner / unit depth), the OWD baseline, and explicit sharing.',
  EXTERNAL:
    'Explicitly shared rows ONLY — OWD baselines and sharing rules never apply; a misconfiguration can only shrink visibility, never widen it.',
};

/** Capability-grant evidence the posture derivation consumes (ADR-0095 D3). */
export interface PostureEvidence {
  /**
   * Holds the UNSCOPED platform-admin capability grant (`admin_full_access` →
   * `viewAllRecords`/`modifyAllRecords`) — the same evidence the superuser
   * bypass trusts. NOT a better-auth role.
   */
  isPlatformAdmin: boolean;
  /**
   * Holds the org-admin capability grant (`organization_admin`, tenant-scoped
   * `viewAllRecords`/`modifyAllRecords`). Provisioned from the better-auth
   * owner/admin role upstream, consumed here only as a held capability.
   */
  isTenantAdmin: boolean;
}

/**
 * Resolve the principal's posture rung from held capability grants (ADR-0095 D3).
 *
 * Returns `PLATFORM_ADMIN` | `TENANT_ADMIN` | `MEMBER`. It NEVER returns
 * `EXTERNAL`: no external principal type exists yet (the sharing chain has no
 * portal/guest-share concept — ADR-0095 W4). The `EXTERNAL` rung, its injection
 * rule, and its semantics are defined and test-locked ({@link postureVisibleRows},
 * {@link POSTURE_INJECTION_RULE}) so that when portal/external membership lands
 * (ADR-0093) the derivation gains an EXTERNAL branch HERE without the rung being
 * reinvented. `MEMBER` is the authenticated-principal floor.
 */
export function derivePosture(evidence: PostureEvidence): AuthzPosture {
  if (evidence.isPlatformAdmin) return 'PLATFORM_ADMIN';
  if (evidence.isTenantAdmin) return 'TENANT_ADMIN';
  return 'MEMBER';
}

// ── Reference visibility model (invariant lock, NOT enforcement) ─────────────

/** A synthetic record for the ladder reference model. */
export interface LadderRow {
  id: string;
  /** The row's tenant. `undefined` = a non-tenant (platform-global) row. */
  organization_id?: string;
  /** The row's owner (drives the MEMBER ownership disjunct). */
  owner_id?: string;
  /**
   * Whether an OWD-derived source would admit this row for a member (public
   * baseline / criteria sharing). EXTERNAL deliberately ignores this field.
   */
  owdVisible?: boolean;
  /** User ids this row is EXPLICITLY shared to (the only EXTERNAL source). */
  sharedTo?: readonly string[];
}

/** The principal the reference model evaluates a rung for. */
export interface LadderPrincipal {
  userId: string;
  /** The principal's active organization (undefined for an unscoped principal). */
  organizationId?: string;
}

function isSharedTo(row: LadderRow, userId: string): boolean {
  return (row.sharedTo ?? []).includes(userId);
}

/** EXTERNAL rung: explicitly shared rows ONLY — never OWD, never org-wide. */
function externalVisible(rows: readonly LadderRow[], p: LadderPrincipal): LadderRow[] {
  return rows.filter((r) => isSharedTo(r, p.userId));
}

/**
 * MEMBER rung: business RLS within the org — ownership OR OWD baseline OR
 * explicit sharing. Composed as `EXTERNAL ∪ (in-org ownership/OWD)` so the
 * EXTERNAL ⊆ MEMBER leg of the nesting invariant holds by construction.
 */
function memberVisible(rows: readonly LadderRow[], p: LadderPrincipal): LadderRow[] {
  const shared = new Set(externalVisible(rows, p));
  return rows.filter(
    (r) =>
      shared.has(r) ||
      (r.organization_id === p.organizationId && (r.owner_id === p.userId || r.owdVisible === true)),
  );
}

/**
 * TENANT_ADMIN rung: all rows in the active organization. Composed as
 * `MEMBER ∪ (all in-org)` so MEMBER ⊆ TENANT_ADMIN holds by construction.
 */
function tenantAdminVisible(rows: readonly LadderRow[], p: LadderPrincipal): LadderRow[] {
  const member = new Set(memberVisible(rows, p));
  return rows.filter((r) => member.has(r) || r.organization_id === p.organizationId);
}

/** PLATFORM_ADMIN rung: crosses the tenant wall — every row (⊇ TENANT_ADMIN trivially). */
function platformAdminVisible(rows: readonly LadderRow[]): LadderRow[] {
  return [...rows];
}

/**
 * Reference model of the per-rung injection rule: the visible-row set a rung
 * would resolve to over `rows` for `principal`. Used to lock the ADR-0095 D2
 * invariants (strict nesting + EXTERNAL deny-by-default). NOT an enforcement
 * path — see the module header.
 */
export function postureVisibleRows(
  posture: AuthzPosture,
  rows: readonly LadderRow[],
  principal: LadderPrincipal,
): LadderRow[] {
  switch (posture) {
    case 'PLATFORM_ADMIN':
      return platformAdminVisible(rows);
    case 'TENANT_ADMIN':
      return tenantAdminVisible(rows, principal);
    case 'MEMBER':
      return memberVisible(rows, principal);
    case 'EXTERNAL':
      return externalVisible(rows, principal);
  }
}
