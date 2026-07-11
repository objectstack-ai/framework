// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0092 D1/D3 — the single source of truth for which `sys_user` columns
 * generic write surfaces may touch.
 *
 * Two tiers, subset-by-construction (a spread, not two hand-maintained
 * lists), because the two surfaces intentionally differ:
 *
 *  - the standard edit form / data API may only touch pure profile fields
 *    (enforced server-side by the identity write guard, ADR-0092 D2);
 *  - the admin bulk-identity import may additionally upsert `phone_number`
 *    (sign-in identifier — bulk identity onboarding is that surface's
 *    purpose) and `role`. Import runs under a system context, so it passes
 *    the guard by context, not by whitelist — this constant is its own
 *    field discipline.
 *
 * Everything not listed here is either admin-surface-only (role/ban columns,
 * `manager_id`, `ai_access`, …) or never-direct (email, credentials, every
 * system-managed stamp). See ADR-0092 D1 for the full tier table. Adding a
 * field to `sys_user` never silently opens it — absence means denied.
 */

/** Tier 1 — standard form / data-API editable (identity write guard whitelist). */
export const SYS_USER_PROFILE_EDIT_FIELDS: ReadonlySet<string> = new Set(['name', 'image']);

/** Import-upsert may additionally touch these (admin bulk-identity surface). */
export const SYS_USER_IMPORT_UPDATE_FIELDS: ReadonlySet<string> = new Set([
  ...SYS_USER_PROFILE_EDIT_FIELDS,
  'phone_number',
  'role',
]);
