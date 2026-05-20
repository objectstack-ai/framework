// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Canonical service-tenant manifest source.
 *
 * Both `objectstack.config.ts` (compile-time) and `tenant-plugin.ts`
 * (runtime `manifest.register`) import from this file so the two
 * registration paths cannot drift (D7).
 */

import {
  SysProject,
  SysProjectCredential,
  SysProjectMember,
  SysProjectRevision,
  SysProjectBranch,
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
  SysApp,
  SysBillingPeriod,
  SysQuotaUsage,
} from './objects/index.js';
import { SysPresence } from '@objectstack/platform-objects';
import { CLOUD_CONTROL_APP } from './apps/index.js';

export const TENANT_SERVICE_ID = 'com.objectstack.service-tenant';
export const TENANT_SERVICE_VERSION = '0.2.0';

/** Tenant/control-plane objects owned by service-tenant. */
export const tenantObjects = [
  SysProject,
  SysProjectCredential,
  SysProjectMember,
  SysProjectRevision,
  SysProjectBranch,
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
  SysApp,
  SysBillingPeriod,
  SysQuotaUsage,
  // Real-time presence — registered here so Console's presence poll
  // (`/api/v1/data/sys_presence?...`) returns 200 with an empty list
  // instead of 404-spamming on every page load. service-realtime owns
  // the write path; we just need the read endpoint to exist.
  SysPresence,
];

/** Control-plane Apps surfaced in the App switcher when service-tenant is loaded. */
export const tenantApps = [CLOUD_CONTROL_APP];

/** Manifest header shared by compile-time config and runtime registration. */
export const tenantServiceManifestHeader = {
  id: TENANT_SERVICE_ID,
  namespace: 'sys',
  version: TENANT_SERVICE_VERSION,
  type: 'plugin' as const,
  scope: 'cloud' as const,
  name: 'Tenant Service',
  description: 'Multi-tenant project registry, package catalog, and org-scoped app metadata',
};
