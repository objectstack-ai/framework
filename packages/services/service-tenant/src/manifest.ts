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
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
  SysApp,
} from './objects/index.js';

export const TENANT_SERVICE_ID = 'com.objectstack.service-tenant';
export const TENANT_SERVICE_VERSION = '0.2.0';

/** Tenant/control-plane objects owned by service-tenant. */
export const tenantObjects = [
  SysProject,
  SysProjectCredential,
  SysProjectMember,
  SysProjectRevision,
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
  SysApp,
];

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
