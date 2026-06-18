// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * @objectstack/plugin-org-scoping
 *
 * Row-level Organization isolation for ObjectStack:
 *   - auto-stamps `organization_id` on insert from
 *     `ExecutionContext.tenantId`,
 *   - replays seed datasets (or clones from the donor org) on every
 *     `sys_organization` insert,
 *   - bootstraps a Default Organization for the first platform admin.
 *
 * Pair with `@objectstack/plugin-security` to get full multi-tenant
 * RBAC + RLS + Field-Level Security. Install standalone for
 * single-tenant deployments — plugin-security detects this plugin's
 * presence via `getService('org-scoping')` and adjusts wildcard
 * tenant policy handling accordingly.
 */

export { OrgScopingPlugin } from './org-scoping-plugin.js';
export type { OrgScopingPluginOptions } from './org-scoping-plugin.js';
export { claimOrphanOrgRows } from './claim-orphan-org-rows.js';
export { claimOrgSeedOwnership } from './claim-org-seed-ownership.js';
export { cloneOrgSeedData } from './clone-org-seed-data.js';
export {
  ensureDefaultOrganization,
  type EnsureDefaultOrganizationResult,
} from './ensure-default-organization.js';
export {
  orgScopingObjects,
  orgScopingPluginManifestHeader,
  ORG_SCOPING_PLUGIN_ID,
  ORG_SCOPING_PLUGIN_VERSION,
} from './manifest.js';
