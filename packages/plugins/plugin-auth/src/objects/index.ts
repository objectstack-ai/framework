// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Auth Plugin — System Object Definitions (sys namespace)
 *
 * Canonical ObjectSchema definitions for all authentication-related system objects.
 * All objects belong to the `sys` namespace and follow the unified naming convention:
 *   - File: `sys-{name}.object.ts`
 *   - Export: `Sys{PascalCase}`
 *   - Object name: `{name}` (snake_case, no prefix)
 *   - Table name: `sys_{name}` (auto-derived from namespace)
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

// ── Additional Auth Objects ────────────────────────────────────────────────
export { SysApiKey } from './sys-api-key.object.js';
export { SysTwoFactor } from './sys-two-factor.object.js';

// ── Backward Compatibility (deprecated) ────────────────────────────────────
/** @deprecated Use `SysUser` instead */
export { AuthUser } from './auth-user.object.js';
/** @deprecated Use `SysSession` instead */
export { AuthSession } from './auth-session.object.js';
/** @deprecated Use `SysAccount` instead */
export { AuthAccount } from './auth-account.object.js';
/** @deprecated Use `SysVerification` instead */
export { AuthVerification } from './auth-verification.object.js';
