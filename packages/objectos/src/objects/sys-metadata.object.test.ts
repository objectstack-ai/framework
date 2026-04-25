// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { SysMetadata } from '@objectstack/system-objects/metadata';

describe('SysMetadata Object', () => {
  it('should have correct object name', () => {
    expect(SysMetadata.name).toBe('sys_metadata');
  });

  it('should not have a separate namespace field', () => {
    expect((SysMetadata as any).namespace).toBeUndefined();
  });

  it('should have required fields', () => {
    expect(SysMetadata.fields.name).toBeDefined();
    expect(SysMetadata.fields.type).toBeDefined();
    expect(SysMetadata.fields.package_id).toBeDefined();
    expect(SysMetadata.fields.version).toBeDefined();
  });

  it('should have tracking capabilities enabled', () => {
    expect(SysMetadata.enable?.trackHistory).toBe(true);
    expect(SysMetadata.enable?.apiEnabled).toBe(true);
  });
});
