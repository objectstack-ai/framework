// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { appDefaultPermissionSetName } from './app-default-permission-set';

describe('appDefaultPermissionSetName (ADR-0090 D5)', () => {
  it('returns the name of the first isDefault permission set', () => {
    expect(
      appDefaultPermissionSetName([
        { name: 'read_only' },
        { name: 'member_std', isDefault: true },
        { name: 'member_other', isDefault: true },
      ]),
    ).toBe('member_std');
  });

  it('returns undefined when nothing is marked default', () => {
    expect(appDefaultPermissionSetName([{ name: 'read_only' }])).toBeUndefined();
    expect(appDefaultPermissionSetName(undefined)).toBeUndefined();
    expect(appDefaultPermissionSetName([])).toBeUndefined();
  });

  it('ignores malformed entries', () => {
    expect(
      appDefaultPermissionSetName([null, 42, { isDefault: true }, { name: '', isDefault: true }, { name: 'ok', isDefault: true }]),
    ).toBe('ok');
  });
});
