// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { RouteUserContext } from './ai-routes.js';

/**
 * The subset of an agent definition relevant to "who can chat with it".
 * Kept structural (not the full Agent type) so the check is decoupled from the
 * runtime's loaded-agent shape and trivially unit-testable.
 */
export interface AgentAccessSpec {
  /** Allow-list of user IDs or role names permitted to chat. */
  access?: string[];
  /** Permissions or roles the caller must ALL hold to use the agent. */
  permissions?: string[];
  /** Declared scope. Only `private` is gate-able at the route layer today. */
  visibility?: 'global' | 'organization' | 'private';
}

export interface AgentAccessDecision {
  allowed: boolean;
  /** Human-readable reason when denied (safe to surface in a 403). */
  reason?: string;
}

/**
 * Enforce per-agent access control (ADR-0049, #1884).
 *
 * Before this check the chat route only enforced the coarse, static route-level
 * permissions (`['ai:chat','ai:agents']`) — every agent's `access`/`permissions`
 * were a no-op, so "who can chat with this agent" enforced nothing. This closes
 * that gap for the two fields that concretely express it:
 *
 *   - `permissions` (required): the caller must hold EVERY listed entry. An
 *     entry is satisfied if it appears in the caller's `permissions` OR `roles`
 *     (the spec field is "Required permissions or roles"). Empty → no extra
 *     requirement beyond the route-level gate.
 *   - `access` (allow-list): when present and non-empty, the caller must match
 *     at least one entry, by `userId` or by membership in `roles`. Empty/absent
 *     → not restricted by allow-list.
 *
 * `visibility` (`organization`/`private`) is intentionally NOT enforced here:
 * the request context carries no tenant id or agent-owner, so a correct
 * organization/private gate needs auth-middleware changes (tracked separately).
 * Enforcing a partial/guessed version would risk both lock-out and false
 * security, so we enforce only what the context can decide.
 *
 * Fails CLOSED on a malformed user (no userId) — an unauthenticated caller that
 * slipped past the route gate is denied rather than defaulted-open.
 */
export function evaluateAgentAccess(
  agent: AgentAccessSpec,
  user: RouteUserContext | undefined,
): AgentAccessDecision {
  const required = agent.permissions ?? [];
  const allowList = agent.access ?? [];

  // No per-agent restriction declared → allowed (route-level gate already passed).
  if (required.length === 0 && allowList.length === 0) {
    return { allowed: true };
  }

  if (!user || !user.userId) {
    return { allowed: false, reason: 'authentication required to chat with this agent' };
  }

  const held = new Set<string>([...(user.permissions ?? []), ...(user.roles ?? [])]);

  // Required permissions: caller must hold ALL.
  const missing = required.filter((p) => !held.has(p));
  if (missing.length > 0) {
    return {
      allowed: false,
      reason: `missing required permission(s): ${missing.join(', ')}`,
    };
  }

  // Allow-list: caller must match by userId or role.
  if (allowList.length > 0) {
    const roles = new Set<string>(user.roles ?? []);
    const matched = allowList.some((entry) => entry === user.userId || roles.has(entry));
    if (!matched) {
      return { allowed: false, reason: 'not in this agent’s access list' };
    }
  }

  return { allowed: true };
}
