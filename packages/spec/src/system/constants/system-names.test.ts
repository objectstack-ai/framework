import { describe, it, expect } from 'vitest';
import {
  SystemObjectName,
  SystemFieldName,
  StorageNameMapping,
} from './system-names';

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
    expect(keys).toContain('API_KEY');
    expect(keys).toContain('TWO_FACTOR');
    expect(keys).toContain('ROLE');
    expect(keys).toContain('PERMISSION_SET');
    expect(keys).toContain('AUDIT_LOG');
    expect(keys).toContain('METADATA');
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
