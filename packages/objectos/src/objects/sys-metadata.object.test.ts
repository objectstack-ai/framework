// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { SysMetadata } from './sys-metadata.object';

describe('SysMetadata Object', () => {
  it('should have correct object name', () => {
    expect(SysMetadata.name).toBe('sys_metadata');
  });

  it('should have sys namespace', () => {
    expect(SysMetadata.namespace).toBe('sys');
  });

  it('should have required fields', () => {
    expect(SysMetadata.fields.name).toBeDefined();
    expect(SysMetadata.fields.type).toBeDefined();
    expect(SysMetadata.fields.package_id).toBeDefined();
    expect(SysMetadata.fields.version).toBeDefined();
  });

  it('should have tracking capabilities enabled', () => {
    expect(SysMetadata.enable?.trackHistory).toBe(true);
    expect(SysMetadata.enable?.searchable).toBe(true);
    expect(SysMetadata.enable?.apiEnabled).toBe(true);
  });
});
