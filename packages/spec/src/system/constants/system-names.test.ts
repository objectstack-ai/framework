import { describe, it, expect } from 'vitest';
import {
  SYSTEM_NAMESPACE,
  SystemObjectName,
  SystemFieldName,
  StorageNameMapping,
  SystemPermissionName,
  SystemEventName,
  SystemRoutePath,
  SystemRef,
} from './system-names';

// ============================================================================
// SYSTEM_NAMESPACE
// ============================================================================

describe('SYSTEM_NAMESPACE', () => {
  it('should equal "sys"', () => {
    expect(SYSTEM_NAMESPACE).toBe('sys');
  });

  it('should be a string literal (const)', () => {
    const ns: 'sys' = SYSTEM_NAMESPACE;
    expect(ns).toBe('sys');
  });
});

// ============================================================================
// SystemObjectName
// ============================================================================

describe('SystemObjectName', () => {
  it('should expose all expected object names with sys_ prefix', () => {
    expect(SystemObjectName.USER).toBe('sys_user');
    expect(SystemObjectName.SESSION).toBe('sys_session');
    expect(SystemObjectName.ACCOUNT).toBe('sys_account');
    expect(SystemObjectName.VERIFICATION).toBe('sys_verification');
    expect(SystemObjectName.ORGANIZATION).toBe('sys_organization');
    expect(SystemObjectName.MEMBER).toBe('sys_member');
    expect(SystemObjectName.INVITATION).toBe('sys_invitation');
    expect(SystemObjectName.TEAM).toBe('sys_team');
    expect(SystemObjectName.TEAM_MEMBER).toBe('sys_team_member');
    expect(SystemObjectName.API_KEY).toBe('sys_api_key');
    expect(SystemObjectName.TWO_FACTOR).toBe('sys_two_factor');
    expect(SystemObjectName.ROLE).toBe('sys_role');
    expect(SystemObjectName.PERMISSION_SET).toBe('sys_permission_set');
    expect(SystemObjectName.AUDIT_LOG).toBe('sys_audit_log');
    expect(SystemObjectName.METADATA).toBe('sys_metadata');
  });

  it('should be readonly (const assertion)', () => {
    const names: readonly string[] = Object.values(SystemObjectName);
    expect(names).toContain('sys_user');
    expect(names).toContain('sys_session');
    expect(names).toContain('sys_organization');
    expect(names).toContain('sys_team');
    expect(names).toContain('sys_team_member');
    expect(names).toContain('sys_role');
    expect(names).toContain('sys_audit_log');
  });

  it('should have all expected keys', () => {
    const keys = Object.keys(SystemObjectName);
    expect(keys).toContain('USER');
    expect(keys).toContain('SESSION');
    expect(keys).toContain('ACCOUNT');
    expect(keys).toContain('VERIFICATION');
    expect(keys).toContain('ORGANIZATION');
    expect(keys).toContain('MEMBER');
    expect(keys).toContain('INVITATION');
    expect(keys).toContain('TEAM');
    expect(keys).toContain('TEAM_MEMBER');
    expect(keys).toContain('API_KEY');
    expect(keys).toContain('TWO_FACTOR');
    expect(keys).toContain('ROLE');
    expect(keys).toContain('PERMISSION_SET');
    expect(keys).toContain('AUDIT_LOG');
    expect(keys).toContain('METADATA');
  });

  it('every value should start with SYSTEM_NAMESPACE + underscore', () => {
    const prefix = `${SYSTEM_NAMESPACE}_`;
    for (const value of Object.values(SystemObjectName)) {
      expect(value.startsWith(prefix)).toBe(true);
    }
  });
});

// ============================================================================
// SystemFieldName
// ============================================================================

describe('SystemFieldName', () => {
  it('should expose all expected field names', () => {
    expect(SystemFieldName.ID).toBe('id');
    expect(SystemFieldName.CREATED_AT).toBe('created_at');
    expect(SystemFieldName.UPDATED_AT).toBe('updated_at');
    expect(SystemFieldName.OWNER_ID).toBe('owner_id');
    expect(SystemFieldName.TENANT_ID).toBe('tenant_id');
    expect(SystemFieldName.USER_ID).toBe('user_id');
    expect(SystemFieldName.DELETED_AT).toBe('deleted_at');
  });

  it('should be readonly (const assertion)', () => {
    const names: readonly string[] = Object.values(SystemFieldName);
    expect(names).toContain('id');
    expect(names).toContain('owner_id');
  });
});

// ============================================================================
// StorageNameMapping
// ============================================================================

describe('StorageNameMapping', () => {
  describe('resolveTableName', () => {
    it('should return tableName when specified', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'user', tableName: 'ba_users' })).toBe('ba_users');
    });

    it('should fall back to name when tableName is not set', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'user' })).toBe('user');
    });

    it('should fall back to name when tableName is undefined', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'session', tableName: undefined })).toBe('session');
    });

    it('should auto-derive table name from namespace + name', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'user', namespace: 'sys' })).toBe('sys_user');
    });

    it('should prefer explicit tableName over namespace derivation', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'user', namespace: 'sys', tableName: 'custom_users' })).toBe('custom_users');
    });

    it('should derive multi-word name with namespace', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'audit_log', namespace: 'sys' })).toBe('sys_audit_log');
    });

    it('should fall back to name when namespace is undefined', () => {
      expect(StorageNameMapping.resolveTableName({ name: 'account', namespace: undefined })).toBe('account');
    });
  });

  describe('resolveColumnName', () => {
    it('should return columnName when specified', () => {
      expect(StorageNameMapping.resolveColumnName('user_id', { columnName: 'userId' })).toBe('userId');
    });

    it('should fall back to fieldKey when columnName is not set', () => {
      expect(StorageNameMapping.resolveColumnName('user_id', {})).toBe('user_id');
    });

    it('should fall back to fieldKey when columnName is undefined', () => {
      expect(StorageNameMapping.resolveColumnName('email', { columnName: undefined })).toBe('email');
    });
  });

  describe('buildColumnMap', () => {
    it('should build a complete field-key → column-name map', () => {
      const fields = {
        user_id: { columnName: 'userId' },
        email: {},
        expires_at: { columnName: 'expiresAt' },
      };

      const map = StorageNameMapping.buildColumnMap(fields);

      expect(map).toEqual({
        user_id: 'userId',
        email: 'email',
        expires_at: 'expiresAt',
      });
    });

    it('should return empty map for empty fields', () => {
      expect(StorageNameMapping.buildColumnMap({})).toEqual({});
    });
  });

  describe('buildReverseColumnMap', () => {
    it('should build a reverse column-name → field-key map', () => {
      const fields = {
        user_id: { columnName: 'userId' },
        email: {},
        expires_at: { columnName: 'expiresAt' },
      };

      const reverseMap = StorageNameMapping.buildReverseColumnMap(fields);

      expect(reverseMap).toEqual({
        userId: 'user_id',
        email: 'email',
        expiresAt: 'expires_at',
      });
    });

    it('should return empty map for empty fields', () => {
      expect(StorageNameMapping.buildReverseColumnMap({})).toEqual({});
    });

    it('should handle all fields without columnName (identity mapping)', () => {
      const fields = {
        name: {},
        status: {},
      };

      const reverseMap = StorageNameMapping.buildReverseColumnMap(fields);

      expect(reverseMap).toEqual({
        name: 'name',
        status: 'status',
      });
    });
  });
});

// ============================================================================
// SystemPermissionName
// ============================================================================

describe('SystemPermissionName', () => {
  it('should expose all expected permission names with sys:: prefix', () => {
    expect(SystemPermissionName.MANAGE_USERS).toBe('sys::manage_users');
    expect(SystemPermissionName.MANAGE_ORGANIZATIONS).toBe('sys::manage_organizations');
    expect(SystemPermissionName.MANAGE_TEAMS).toBe('sys::manage_teams');
    expect(SystemPermissionName.MANAGE_ROLES).toBe('sys::manage_roles');
    expect(SystemPermissionName.MANAGE_PERMISSION_SETS).toBe('sys::manage_permission_sets');
    expect(SystemPermissionName.MANAGE_API_KEYS).toBe('sys::manage_api_keys');
    expect(SystemPermissionName.VIEW_ALL_DATA).toBe('sys::view_all_data');
    expect(SystemPermissionName.MODIFY_ALL_DATA).toBe('sys::modify_all_data');
    expect(SystemPermissionName.VIEW_SETUP).toBe('sys::view_setup');
    expect(SystemPermissionName.CUSTOMIZE_APPLICATION).toBe('sys::customize_application');
    expect(SystemPermissionName.MANAGE_METADATA).toBe('sys::manage_metadata');
    expect(SystemPermissionName.VIEW_AUDIT_LOG).toBe('sys::view_audit_log');
    expect(SystemPermissionName.RUN_REPORTS).toBe('sys::run_reports');
    expect(SystemPermissionName.EXPORT_REPORTS).toBe('sys::export_reports');
  });

  it('every value should start with sys:: prefix', () => {
    for (const value of Object.values(SystemPermissionName)) {
      expect(value.startsWith('sys::')).toBe(true);
    }
  });

  it('should have all expected keys', () => {
    const keys = Object.keys(SystemPermissionName);
    expect(keys).toEqual(expect.arrayContaining([
      'MANAGE_USERS',
      'MANAGE_ORGANIZATIONS',
      'MANAGE_TEAMS',
      'MANAGE_ROLES',
      'MANAGE_PERMISSION_SETS',
      'MANAGE_API_KEYS',
      'VIEW_ALL_DATA',
      'MODIFY_ALL_DATA',
      'VIEW_SETUP',
      'CUSTOMIZE_APPLICATION',
      'MANAGE_METADATA',
      'VIEW_AUDIT_LOG',
      'RUN_REPORTS',
      'EXPORT_REPORTS',
    ]));
  });

  it('should be readonly (const assertion)', () => {
    const values: readonly string[] = Object.values(SystemPermissionName);
    expect(values.length).toBe(14);
  });
});

// ============================================================================
// SystemEventName
// ============================================================================

describe('SystemEventName', () => {
  it('should expose all expected event names with sys:: prefix', () => {
    expect(SystemEventName.USER_CREATED).toBe('sys::user.created');
    expect(SystemEventName.USER_UPDATED).toBe('sys::user.updated');
    expect(SystemEventName.USER_DELETED).toBe('sys::user.deleted');
    expect(SystemEventName.SESSION_CREATED).toBe('sys::session.created');
    expect(SystemEventName.SESSION_EXPIRED).toBe('sys::session.expired');
    expect(SystemEventName.ROLE_ASSIGNED).toBe('sys::role.assigned');
    expect(SystemEventName.ROLE_REVOKED).toBe('sys::role.revoked');
    expect(SystemEventName.PERMISSION_CHANGED).toBe('sys::permission.changed');
    expect(SystemEventName.ORGANIZATION_CREATED).toBe('sys::organization.created');
    expect(SystemEventName.TEAM_CREATED).toBe('sys::team.created');
    expect(SystemEventName.MEMBER_ADDED).toBe('sys::member.added');
    expect(SystemEventName.MEMBER_REMOVED).toBe('sys::member.removed');
    expect(SystemEventName.API_KEY_CREATED).toBe('sys::api_key.created');
    expect(SystemEventName.API_KEY_REVOKED).toBe('sys::api_key.revoked');
    expect(SystemEventName.AUDIT_LOG_CREATED).toBe('sys::audit_log.created');
    expect(SystemEventName.METADATA_UPDATED).toBe('sys::metadata.updated');
  });

  it('every value should start with sys:: prefix', () => {
    for (const value of Object.values(SystemEventName)) {
      expect(value.startsWith('sys::')).toBe(true);
    }
  });

  it('every value should follow sys::{object}.{action} pattern', () => {
    const pattern = /^sys::[a-z_]+\.[a-z_]+$/;
    for (const value of Object.values(SystemEventName)) {
      expect(value).toMatch(pattern);
    }
  });

  it('should have all expected keys', () => {
    const keys = Object.keys(SystemEventName);
    expect(keys).toEqual(expect.arrayContaining([
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'SESSION_CREATED',
      'SESSION_EXPIRED',
      'ROLE_ASSIGNED',
      'ROLE_REVOKED',
      'PERMISSION_CHANGED',
      'ORGANIZATION_CREATED',
      'TEAM_CREATED',
      'MEMBER_ADDED',
      'MEMBER_REMOVED',
      'API_KEY_CREATED',
      'API_KEY_REVOKED',
      'AUDIT_LOG_CREATED',
      'METADATA_UPDATED',
    ]));
  });

  it('should be readonly (const assertion)', () => {
    const values: readonly string[] = Object.values(SystemEventName);
    expect(values.length).toBe(16);
  });
});

// ============================================================================
// SystemRoutePath
// ============================================================================

describe('SystemRoutePath', () => {
  it('should expose frontend route paths', () => {
    expect(SystemRoutePath.SYSTEM_PREFIX).toBe('/system');
    expect(SystemRoutePath.SYSTEM_OBJECTS).toBe('/system/objects');
    expect(SystemRoutePath.SYSTEM_OBJECT_DETAIL).toBe('/system/objects/:name');
  });

  it('should expose API route paths', () => {
    expect(SystemRoutePath.API_OBJECTS).toBe('/api/v1/objects');
    expect(SystemRoutePath.API_OBJECT_BY_NAME).toBe('/api/v1/objects/:name');
    expect(SystemRoutePath.API_DATA).toBe('/api/v1/data/:object');
    expect(SystemRoutePath.API_DATA_RECORD).toBe('/api/v1/data/:object/:id');
  });

  it('API routes should start with /api/v1', () => {
    expect(SystemRoutePath.API_OBJECTS).toMatch(/^\/api\/v1\//);
    expect(SystemRoutePath.API_OBJECT_BY_NAME).toMatch(/^\/api\/v1\//);
    expect(SystemRoutePath.API_DATA).toMatch(/^\/api\/v1\//);
    expect(SystemRoutePath.API_DATA_RECORD).toMatch(/^\/api\/v1\//);
  });

  it('frontend routes should start with /system', () => {
    expect(SystemRoutePath.SYSTEM_PREFIX).toMatch(/^\/system/);
    expect(SystemRoutePath.SYSTEM_OBJECTS).toMatch(/^\/system/);
    expect(SystemRoutePath.SYSTEM_OBJECT_DETAIL).toMatch(/^\/system/);
  });
});

// ============================================================================
// SystemRef
// ============================================================================

describe('SystemRef', () => {
  describe('permission()', () => {
    it('should build a sys:: prefixed permission', () => {
      expect(SystemRef.permission('manage_users')).toBe('sys::manage_users');
    });

    it('should match predefined SystemPermissionName values', () => {
      expect(SystemRef.permission('manage_users')).toBe(SystemPermissionName.MANAGE_USERS);
      expect(SystemRef.permission('view_all_data')).toBe(SystemPermissionName.VIEW_ALL_DATA);
    });
  });

  describe('event()', () => {
    it('should build a sys:: prefixed event with object.action format', () => {
      expect(SystemRef.event('user', 'created')).toBe('sys::user.created');
    });

    it('should match predefined SystemEventName values', () => {
      expect(SystemRef.event('user', 'created')).toBe(SystemEventName.USER_CREATED);
      expect(SystemRef.event('session', 'expired')).toBe(SystemEventName.SESSION_EXPIRED);
      expect(SystemRef.event('audit_log', 'created')).toBe(SystemEventName.AUDIT_LOG_CREATED);
    });
  });

  describe('isSystemObject()', () => {
    it('should return true for sys_ prefixed names', () => {
      expect(SystemRef.isSystemObject('sys_user')).toBe(true);
      expect(SystemRef.isSystemObject('sys_audit_log')).toBe(true);
    });

    it('should return false for non-system names', () => {
      expect(SystemRef.isSystemObject('project')).toBe(false);
      expect(SystemRef.isSystemObject('crm_account')).toBe(false);
    });
  });

  describe('isSystemPermission()', () => {
    it('should return true for sys:: prefixed permissions', () => {
      expect(SystemRef.isSystemPermission('sys::manage_users')).toBe(true);
      expect(SystemRef.isSystemPermission('sys::view_all_data')).toBe(true);
    });

    it('should return false for non-system permissions', () => {
      expect(SystemRef.isSystemPermission('manage_users')).toBe(false);
      expect(SystemRef.isSystemPermission('app::custom')).toBe(false);
    });
  });

  describe('isSystemEvent()', () => {
    it('should return true for sys:: prefixed events', () => {
      expect(SystemRef.isSystemEvent('sys::user.created')).toBe(true);
      expect(SystemRef.isSystemEvent('sys::metadata.updated')).toBe(true);
    });

    it('should return false for non-system events', () => {
      expect(SystemRef.isSystemEvent('user.created')).toBe(false);
      expect(SystemRef.isSystemEvent('app::task.completed')).toBe(false);
    });
  });
});
