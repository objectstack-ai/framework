// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Smoke tests for the renamed sys_environment / sys_environment_credential /
 * sys_environment_member object shapes (ADR-0006 v3 — Round 5).
 */
import { describe, it, expect } from 'vitest';
import {
  SysEnvironment,
  SysEnvironmentCredential,
  SysEnvironmentMember,
} from './index.js';

describe('sys_environment* objects', () => {
  it('exports the renamed objects under sys_environment* table names', () => {
    expect(SysEnvironment.name).toBe('sys_environment');
    expect(SysEnvironmentCredential.name).toBe('sys_environment_credential');
    expect(SysEnvironmentMember.name).toBe('sys_environment_member');
  });

  it('declares UNIQUE hostname on sys_environment', () => {
    const hostIdx = SysEnvironment.indexes?.find((i: any) =>
      Array.isArray(i.fields) && i.fields.length === 1 && i.fields[0] === 'hostname',
    );
    expect(hostIdx?.unique).toBe(true);
  });

  it('sys_environment has database addressing fields', () => {
    const f: any = SysEnvironment.fields;
    expect(f.database_url).toBeDefined();
    expect(f.database_driver).toBeDefined();
    expect(f.hostname).toBeDefined();
  });

  it('declares UNIQUE (environment_id, user_id) on sys_environment_member', () => {
    const idx = SysEnvironmentMember.indexes?.find((i: any) =>
      Array.isArray(i.fields) && i.fields.includes('environment_id') && i.fields.includes('user_id'),
    );
    expect(idx?.unique).toBe(true);
  });
});
