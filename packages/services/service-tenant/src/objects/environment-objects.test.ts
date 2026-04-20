// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  SysEnvironment,
  SysDatabaseCredential,
  SysEnvironmentMember,
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
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

describe('control-plane package objects (ADR-0003)', () => {
  it('registers sys_package and sys_package_version with correct namespaced names', () => {
    expect(`${SysPackage.namespace}_${SysPackage.name}`).toBe('sys_package');
    expect(`${SysPackageVersion.namespace}_${SysPackageVersion.name}`).toBe('sys_package_version');
    expect(`${SysPackageInstallation.namespace}_${SysPackageInstallation.name}`).toBe('sys_package_installation');
  });

  it('marks all package objects as system objects', () => {
    expect(SysPackage.isSystem).toBe(true);
    expect(SysPackageVersion.isSystem).toBe(true);
    expect(SysPackageInstallation.isSystem).toBe(true);
  });

  it('sys_package has UNIQUE manifest_id index', () => {
    const idx = SysPackage.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'manifest_id'),
    ).toBe(true);
  });

  it('sys_package_version has UNIQUE (package_id, version) index', () => {
    const idx = SysPackageVersion.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'package_id,version'),
    ).toBe(true);
  });

  it('sys_package_installation has UNIQUE (environment_id, package_id) index', () => {
    const idx = SysPackageInstallation.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'environment_id,package_id'),
    ).toBe(true);
  });

  it('sys_package_installation has package_version_id field (not a version string)', () => {
    expect(SysPackageInstallation.fields).toHaveProperty('package_version_id');
    expect(SysPackageInstallation.fields).not.toHaveProperty('upgrade_history');
  });

  it('sys_package_installation has package_version_id index', () => {
    const idx = SysPackageInstallation.indexes ?? [];
    expect(
      idx.some((i: any) => i.fields.join(',') === 'package_version_id'),
    ).toBe(true);
  });

  it('gives every field on sys_package a .description', () => {
    for (const [name, field] of Object.entries(SysPackage.fields)) {
      expect((field as any).description, `sys_package.${name} missing description`).toBeTruthy();
    }
  });

  it('gives every field on sys_package_version a .description', () => {
    for (const [name, field] of Object.entries(SysPackageVersion.fields)) {
      expect((field as any).description, `sys_package_version.${name} missing description`).toBeTruthy();
    }
  });

  it('gives every field on sys_package_installation a .description', () => {
    for (const [name, field] of Object.entries(SysPackageInstallation.fields)) {
      expect((field as any).description, `sys_package_installation.${name} missing description`).toBeTruthy();
    }
  });
});
