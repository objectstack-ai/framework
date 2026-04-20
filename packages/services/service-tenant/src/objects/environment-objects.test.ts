// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  SysEnvironment,
  SysDatabaseCredential,
  SysEnvironmentMember,
} from './index';

describe('control-plane environment objects', () => {
  it('registers all sys_ objects with correct namespaced names', () => {
    expect(`${SysEnvironment.namespace}_${SysEnvironment.name}`).toBe('sys_environment');
    expect(`${SysDatabaseCredential.namespace}_${SysDatabaseCredential.name}`).toBe(
      'sys_database_credential',
    );
    expect(`${SysEnvironmentMember.namespace}_${SysEnvironmentMember.name}`).toBe(
      'sys_environment_member',
    );
  });

  it('declares UNIQUE (organization_id, slug) on sys_environment', () => {
    const idx = SysEnvironment.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'organization_id,slug'),
    ).toBe(true);
  });

  it('sys_environment has database addressing fields', () => {
    expect(SysEnvironment.fields).toHaveProperty('database_url');
    expect(SysEnvironment.fields).toHaveProperty('database_driver');
    expect(SysEnvironment.fields).toHaveProperty('storage_limit_mb');
    expect(SysEnvironment.fields).toHaveProperty('provisioned_at');
  });

  it('declares UNIQUE (environment_id, user_id) on sys_environment_member', () => {
    const idx = SysEnvironmentMember.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'environment_id,user_id'),
    ).toBe(true);
  });

  it('gives every field on sys_environment a .description', () => {
    for (const [name, field] of Object.entries(SysEnvironment.fields)) {
      expect((field as any).description, `field ${name} missing description`).toBeTruthy();
    }
  });

  it('marks sys_environment as a system object', () => {
    expect(SysEnvironment.isSystem).toBe(true);
    expect(SysDatabaseCredential.isSystem).toBe(true);
    expect(SysEnvironmentMember.isSystem).toBe(true);
  });
});
