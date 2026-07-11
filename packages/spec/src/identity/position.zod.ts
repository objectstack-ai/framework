// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { z } from 'zod';
import { SnakeCaseIdentifierSchema } from '../shared/identifiers.zod';

/**
 * Position Schema — the flat capability-distribution group (ADR-0090 D3).
 *
 * A position (岗位, "job role" in NetSuite/Workday terms) is a **named,
 * assignable bundle of permission sets**: users hold positions
 * (`sys_user_position`), positions bind permission sets
 * (`sys_position_permission_set`), and a user's capability is the union of
 * every set reached that way plus direct grants.
 *
 * Positions are deliberately **flat** — no `parent`, no hierarchy. The
 * visibility hierarchy lives on the business-unit tree (`sys_business_unit`,
 * ADR-0057 D2) and the manager chain (`sys_user.manager_id`); re-adding a
 * second tree here is the mistake ADR-0057 D5 retired and ADR-0090 D3
 * finalizes.
 *
 * VOCABULARY (ADR-0090 D3): the word "role" is reserved-forbidden across the
 * platform — capability = permission_set, distribution = position,
 * hierarchy = business_unit. The sole exception is better-auth's internal
 * `sys_member.role` (org-membership tier), projected as
 * `org_membership_level`.
 *
 * **NAMING CONVENTION:**
 * Position names MUST be lowercase snake_case to prevent security issues.
 *
 * @example Good position names
 * - 'sales_manager'
 * - 'ceo'
 * - 'region_east_vp'
 * - 'engineering_lead'
 *
 * @example Bad position names (will be rejected)
 * - 'SalesManager' (camelCase)
 * - 'CEO' (uppercase)
 * - 'Region East VP' (spaces and uppercase)
 */
import { lazySchema } from '../shared/lazy-schema';
export const PositionSchema = lazySchema(() => z.object({
  /** Identity */
  name: SnakeCaseIdentifierSchema.describe('Unique position name (lowercase snake_case)'),
  label: z.string().describe('Display label (e.g. VP of Sales)'),

  /** Description */
  description: z.string().optional(),

  /**
   * [ADR-0091 D3] Delegation of duty (职务代理). When true, a holder of this
   * position may SELF-SERVICE assign it to a delegate — time-boxed
   * (`valid_until` within the config ceiling), reasoned, dual-audited —
   * WITHOUT being a delegated administrator. Default false: approval-duty
   * positions (an approver going on leave) opt in; admin-ish positions do
   * NOT — delegating administration would bypass the D12 containment gate,
   * so a delegatable position must never distribute an `adminScope`-carrying
   * set (enforced by the `security-delegatable-admin-position` lint rule and
   * the D12 gate). A grant that itself arrived via delegation is not
   * re-delegatable (chains are cut).
   */
  delegatable: z.boolean().default(false).describe(
    'ADR-0091 D3: holders may self-service delegate this position, time-boxed (default false).',
  ),
}));

/**
 * [ADR-0090 D5/D9] Built-in AUDIENCE ANCHOR positions. `everyone` is held
 * implicitly by every authenticated org member — sets bound to it are the
 * tenant's default grants (resolved per-request; additive, no fallback
 * cliff). `guest` is held implicitly (and exclusively) by unauthenticated
 * principals; its bindings face the strictest lint tier. Packages SUGGEST
 * bindings to these anchors at install time — never auto-bind.
 */
export const EVERYONE_POSITION = 'everyone';
export const GUEST_POSITION = 'guest';
export const AUDIENCE_ANCHOR_POSITIONS = [EVERYONE_POSITION, GUEST_POSITION] as const;

export type Position = z.infer<typeof PositionSchema>;
/** Authoring input for {@link Position} — defaulted fields are optional. */
export type PositionInput = z.input<typeof PositionSchema>;

/**
 * Type-safe factory for a position (flat capability-distribution group).
 * Validates at authoring time via `.parse()` and accepts input-shape config —
 * preferred over a bare `: Position` literal.
 */
export function definePosition(config: z.input<typeof PositionSchema>): Position {
  return PositionSchema.parse(config);
}
