// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Historical filename — kept for git history continuity. Tests the
 * renamed `sys_project` / `sys_project_credential` / `sys_project_member`
 * control-plane objects that superseded the `sys_environment*` family
 * during the project-per-database migration (see
 * docs/adr/0002-environment-database-isolation.md).
 */

import { describe, it, expect } from 'vitest';
import {
  SysProject,
  SysProjectCredential,
  SysProjectMember,
  SysPackage,
  SysPackageVersion,
  SysPackageInstallation,
} from './index';

describe('control-plane project objects', () => {
  it('registers all sys_ objects with correct namespaced names', () => {
    expect(`${SysProject.namespace}_${SysProject.name}`).toBe('sys_project');
    expect(`${SysProjectCredential.namespace}_${SysProjectCredential.name}`).toBe(
      'sys_project_credential',
    );
    expect(`${SysProjectMember.namespace}_${SysProjectMember.name}`).toBe(
      'sys_project_member',
    );
  });

  it('declares UNIQUE (organization_id, slug) on sys_project', () => {
    const idx = SysProject.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'organization_id,slug'),
    ).toBe(true);
  });

  it('sys_project has database addressing fields', () => {
    expect(SysProject.fields).toHaveProperty('database_url');
    expect(SysProject.fields).toHaveProperty('database_driver');
    expect(SysProject.fields).toHaveProperty('storage_limit_mb');
    expect(SysProject.fields).toHaveProperty('provisioned_at');
  });

  it('sys_project has the is_system flag introduced in Phase 1', () => {
    expect(SysProject.fields).toHaveProperty('is_system');
  });

  it('declares UNIQUE (project_id, user_id) on sys_project_member', () => {
    const idx = SysProjectMember.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'project_id,user_id'),
    ).toBe(true);
  });

  it('gives every field on sys_project a .description', () => {
    for (const [name, field] of Object.entries(SysProject.fields)) {
      expect((field as any).description, `field ${name} missing description`).toBeTruthy();
    }
  });

  it('marks all project control-plane objects as system objects', () => {
    expect(SysProject.isSystem).toBe(true);
    expect(SysProjectCredential.isSystem).toBe(true);
    expect(SysProjectMember.isSystem).toBe(true);
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

  it('sys_package_installation has UNIQUE (project_id, package_id) index', () => {
    const idx = SysPackageInstallation.indexes ?? [];
    expect(
      idx.some((i: any) => i.unique && i.fields.join(',') === 'project_id,package_id'),
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
