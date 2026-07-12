// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * [ADR-0066 D1] Canonical platform capability registry.
 *
 * The built-in authorization capabilities the framework ships, as first-class
 * definitions (name / label / description / scope). This module is the SINGLE
 * SOURCE OF TRUTH consumed by:
 *   - `@objectstack/plugin-security` `bootstrapSystemCapabilities`, which seeds
 *     these into `sys_capability` records at boot (`managed_by: 'platform'`), and
 *   - the authoring lint `validateCapabilityReferences` (ADR-0066 ⑨), which
 *     resolves capability references (`requiredPermissions`) against these names
 *     plus any a stack declares via a permission set's `systemPermissions`.
 *
 * Keeping the list here (in the contract package, which everything depends on)
 * avoids a spec→plugin dependency inversion and keeps the seeder and the lint
 * from drifting apart.
 */

export interface PlatformCapability {
  /** Stable capability name referenced by `systemPermissions` / `requiredPermissions`. */
  name: string;
  /** Human label shown in Setup. */
  label: string;
  /** What holding the capability permits. */
  description: string;
  /** `platform` = global; `org` = scoped to the caller's organization. */
  scope: 'platform' | 'org';
}

/**
 * The curated built-in capabilities. Back-compat: string references to any of
 * these keep resolving because they are seeded as records with the same `name`.
 */
export const PLATFORM_CAPABILITIES: readonly PlatformCapability[] = [
  { name: 'manage_users', label: 'Manage Users', description: 'Create, edit, and deactivate users across the platform.', scope: 'platform' },
  { name: 'manage_org_users', label: 'Manage Organization Users', description: 'Manage members within the caller’s organization.', scope: 'org' },
  { name: 'manage_metadata', label: 'Manage Metadata', description: 'Author and publish object/view/flow and other metadata.', scope: 'platform' },
  { name: 'manage_platform_settings', label: 'Manage Platform Settings', description: 'Configure global platform settings (mail, storage, AI, licensing, …) and platform-only Setup pages.', scope: 'platform' },
  { name: 'setup.access', label: 'Setup Access', description: 'Enter the Setup app shell.', scope: 'platform' },
  // [Finding-1] The write counterpart to `setup.access`: saving changes to
  // tenant/Setup settings pages (branding, company, localization, feature
  // flags). Previously referenced by settings manifests but never declared or
  // granted — which was harmless only while settings writes went ungated.
  { name: 'setup.write', label: 'Write Settings', description: 'Save changes to tenant/Setup settings pages.', scope: 'org' },
  { name: 'studio.access', label: 'Studio Access', description: 'Enter the Studio metadata-design surfaces.', scope: 'platform' },
];

/** Set of built-in capability names, for fast membership checks (lint, gating). */
export const PLATFORM_CAPABILITY_NAMES: ReadonlySet<string> = new Set(
  PLATFORM_CAPABILITIES.map((c) => c.name),
);
