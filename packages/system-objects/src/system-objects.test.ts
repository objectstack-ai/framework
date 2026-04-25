// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import {
  SysAccount,
  SysApiKey,
  SysInvitation,
  SysMember,
  SysOrganization,
  SysSession,
  SysTeam,
  SysTeamMember,
  SysTwoFactor,
  SysUser,
  SysUserPreference,
  SysVerification,
} from './identity/index.js';
import { SysPermissionSet, SysRole } from './security/index.js';
import { SysAuditLog, SysPresence } from './audit/index.js';
import {
  SysApp,
  SysPackage,
  SysPackageInstallation,
  SysPackageVersion,
  SysProject,
  SysProjectCredential,
  SysProjectMember,
  SysTenantDatabase,
} from './tenant/index.js';
import {
  SysAgent,
  SysFlow,
  SysMetadata,
  SysMetadataHistoryObject,
  SysObject,
  SysTool,
  SysView,
} from './metadata/index.js';

const systemObjects = [
  ['SysUser', SysUser, 'sys_user'],
  ['SysSession', SysSession, 'sys_session'],
  ['SysAccount', SysAccount, 'sys_account'],
  ['SysVerification', SysVerification, 'sys_verification'],
  ['SysOrganization', SysOrganization, 'sys_organization'],
  ['SysMember', SysMember, 'sys_member'],
  ['SysInvitation', SysInvitation, 'sys_invitation'],
  ['SysTeam', SysTeam, 'sys_team'],
  ['SysTeamMember', SysTeamMember, 'sys_team_member'],
  ['SysApiKey', SysApiKey, 'sys_api_key'],
  ['SysTwoFactor', SysTwoFactor, 'sys_two_factor'],
  ['SysUserPreference', SysUserPreference, 'sys_user_preference'],
  ['SysRole', SysRole, 'sys_role'],
  ['SysPermissionSet', SysPermissionSet, 'sys_permission_set'],
  ['SysAuditLog', SysAuditLog, 'sys_audit_log'],
  ['SysPresence', SysPresence, 'sys_presence'],
  ['SysProject', SysProject, 'sys_project'],
  ['SysProjectCredential', SysProjectCredential, 'sys_project_credential'],
  ['SysProjectMember', SysProjectMember, 'sys_project_member'],
  ['SysApp', SysApp, 'sys_app'],
  ['SysPackage', SysPackage, 'sys_package'],
  ['SysPackageVersion', SysPackageVersion, 'sys_package_version'],
  ['SysPackageInstallation', SysPackageInstallation, 'sys_package_installation'],
  ['SysTenantDatabase', SysTenantDatabase, 'sys_tenant_database'],
  ['SysMetadata', SysMetadata, 'sys_metadata'],
  ['SysMetadataHistoryObject', SysMetadataHistoryObject, 'sys_metadata_history'],
  ['SysObject', SysObject, 'sys_object'],
  ['SysView', SysView, 'sys_view'],
  ['SysAgent', SysAgent, 'sys_agent'],
  ['SysTool', SysTool, 'sys_tool'],
  ['SysFlow', SysFlow, 'sys_flow'],
] as const;

describe('@objectstack/system-objects', () => {
  it.each(systemObjects)('%s uses a canonical sys_ short name', (_exportName, object, name) => {
    expect(object.name).toBe(name);
  });

  it.each(systemObjects)('%s is marked as a system object', (_exportName, object) => {
    expect(object.isSystem).toBe(true);
  });

  it.each(systemObjects)('%s does not use deprecated storage identity fields', (_exportName, object) => {
    expect((object as any).namespace).toBeUndefined();
    expect((object as any).tableName).toBeUndefined();
  });
});
