// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * system-objects/identity — Identity & Authentication System Objects
 *
 * Canonical ObjectSchema definitions for all authentication-related system objects.
 */

// ── Core Auth Objects ──────────────────────────────────────────────────────
export { SysUser } from './sys-user.object.js';
export { SysSession } from './sys-session.object.js';
export { SysAccount } from './sys-account.object.js';
export { SysVerification } from './sys-verification.object.js';

// ── Organization Objects ───────────────────────────────────────────────────
export { SysOrganization } from './sys-organization.object.js';
export { SysMember } from './sys-member.object.js';
export { SysInvitation } from './sys-invitation.object.js';
export { SysTeam } from './sys-team.object.js';
export { SysTeamMember } from './sys-team-member.object.js';

// ── Additional Auth Objects ────────────────────────────────────────────────
export { SysApiKey } from './sys-api-key.object.js';
export { SysTwoFactor } from './sys-two-factor.object.js';
export { SysUserPreference } from './sys-user-preference.object.js';
