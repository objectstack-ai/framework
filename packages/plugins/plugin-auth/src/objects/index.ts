// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

export * from '@objectstack/system-objects/identity';

// ── Backward Compatibility (deprecated) ────────────────────────────────────
/** @deprecated Use `SysUser` instead */
export { AuthUser } from './auth-user.object.js';
/** @deprecated Use `SysSession` instead */
export { AuthSession } from './auth-session.object.js';
/** @deprecated Use `SysAccount` instead */
export { AuthAccount } from './auth-account.object.js';
/** @deprecated Use `SysVerification` instead */
export { AuthVerification } from './auth-verification.object.js';
