// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { lazySchema } from '../shared/lazy-schema';

/**
 * EvalUser — the one user-context contract (ADR-0068 D1).
 *
 * The signed-in user exposed to every predicate surface (server formula, server
 * RLS, client UI gates) under the canonical variable name `current_user`
 * (aliases `user`, `ctx.user`) with an **identical shape**. A predicate such as
 * `current_user.positions.exists(p, p == 'org_admin')` (or
 * `'org_admin' in current_user.positions`) therefore evaluates identically wherever
 * it is written.
 *
 * `positions: string[]` is the **only canonical** membership field (renamed from
 * `roles`, ADR-0090 D3). A singular field is NOT part of this contract — its legacy "overwritten to 'admin' on promotion"
 * behavior is the footgun this eliminates.
 *
 * @see docs/adr/0068-unified-user-context-and-built-in-identity-roles.md
 */

// ==========================================
// Built-in identity role names (ADR-0068 D2)
// ==========================================

/**
 * Platform operator (SaaS admin). NOT a tenant user role.
 * Unscoped (`org_id = null`); source of truth = unscoped
 * `sys_user_permission_set` -> `admin_full_access`.
 */
export const BUILTIN_IDENTITY_PLATFORM_ADMIN = 'platform_admin';
/** Organization owner within a tenant. Source: `sys_member.role = owner`. */
export const BUILTIN_IDENTITY_ORG_OWNER = 'org_owner';
/** Organization administrator within a tenant. Source: `sys_member.role = admin`. */
export const BUILTIN_IDENTITY_ORG_ADMIN = 'org_admin';
/** Organization member within a tenant. Source: `sys_member.role = member`. */
export const BUILTIN_IDENTITY_ORG_MEMBER = 'org_member';

/**
 * The reserved, framework-seeded role names (ADR-0068 D2). These are a
 * normalized **projection** into `current_user.positions`; their sources of truth
 * (membership rows, the unscoped admin link) are never changed by the projection.
 */
export const BUILTIN_IDENTITY_NAMES = [
  BUILTIN_IDENTITY_PLATFORM_ADMIN,
  BUILTIN_IDENTITY_ORG_OWNER,
  BUILTIN_IDENTITY_ORG_ADMIN,
  BUILTIN_IDENTITY_ORG_MEMBER,
] as const;

export type BuiltinIdentityName = (typeof BUILTIN_IDENTITY_NAMES)[number];

/**
 * Permission-set name whose unscoped grant is the source of truth for
 * `platform_admin` (ADR-0068 D2).
 */
export const ADMIN_FULL_ACCESS = 'admin_full_access';

/** Human-readable metadata for the built-in identity names (seeded into `sys_position`; AI grounding). */
export const BUILTIN_IDENTITY_METADATA: Record<BuiltinIdentityName, { label: string; description: string }> = {
  [BUILTIN_IDENTITY_PLATFORM_ADMIN]: { label: 'Platform Admin', description: 'Platform operator (SaaS admin). NOT a tenant user role.' },
  [BUILTIN_IDENTITY_ORG_OWNER]: { label: 'Organization Owner', description: 'Organization owner within a tenant.' },
  [BUILTIN_IDENTITY_ORG_ADMIN]: { label: 'Organization Admin', description: 'Organization administrator within a tenant.' },
  [BUILTIN_IDENTITY_ORG_MEMBER]: { label: 'Organization Member', description: 'Organization member within a tenant.' },
};

/** Normalize a raw better-auth membership role (owner/admin/member) to its canonical
 * built-in role name (org_owner/org_admin/org_member). Unknown values pass through. */
export function mapMembershipRole(raw: string): string {
  switch (raw.trim().toLowerCase()) {
    case 'owner': return BUILTIN_IDENTITY_ORG_OWNER;
    case 'admin': return BUILTIN_IDENTITY_ORG_ADMIN;
    case 'member': return BUILTIN_IDENTITY_ORG_MEMBER;
    default: return raw.trim();
  }
}

// ==========================================
// Contract
// ==========================================

export const EvalUserSchema = lazySchema(() =>
  z.object({
    id: z.string().describe('User ID'),
    name: z.string().optional().describe('Display name'),
    email: z.string().optional().describe('Email address'),
    /** CANONICAL. Scope-resolved (ADR-0068 D3); built-in identity names + position names. */
    positions: z.array(z.string()).default([]).describe('Canonical position/identity names assigned to the user (scope-resolved)'),
    /** DERIVED alias of positions.includes(platform_admin) (ADR-0068 D2). Deprecated surface. */
    isPlatformAdmin: z.boolean().optional().describe("DERIVED alias of 'platform_admin' in positions. Deprecated."),
    organizationId: z.string().nullable().optional().describe('Active organization ID (null = platform/unscoped)'),
  })
);

export type EvalUser = z.infer<typeof EvalUserSchema>;
/** Authoring input for EvalUser — defaulted fields are optional. */
export type EvalUserInput = z.input<typeof EvalUserSchema>;

/**
 * Build a canonical EvalUser from loosely-typed source fields. The single factory
 * every surface uses (server buildScope, the customSession bridge, objectui
 * fallback/guest/preview users) so the user shape — and the isPlatformAdmin
 * derivation — never drifts. isPlatformAdmin is always derived from positions.
 */
export function createEvalUser(input: {
  id: string;
  name?: string | null;
  email?: string | null;
  positions?: readonly string[] | null;
  organizationId?: string | null;
}): EvalUser {
  const positions = Array.from(
    new Set((input.positions ?? []).map((r) => String(r).trim()).filter(Boolean))
  );
  return {
    id: input.id,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.email != null ? { email: input.email } : {}),
    positions,
    isPlatformAdmin: positions.includes(BUILTIN_IDENTITY_PLATFORM_ADMIN),
    ...(input.organizationId !== undefined ? { organizationId: input.organizationId } : {}),
  };
}
