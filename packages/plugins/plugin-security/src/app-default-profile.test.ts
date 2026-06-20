// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
import { describe, it, expect } from 'vitest';
import { appDefaultProfileName } from './app-default-profile.js';

describe('appDefaultProfileName (ADR-0056 D7)', () => {
  it('returns the name of the first isProfile+isDefault permission set', () => {
    const perms = [
      { name: 'add_on', isProfile: false, isDefault: true }, // not a profile → skipped
      { name: 'member', isProfile: true },                   // not default → skipped
      { name: 'app_default', isProfile: true, isDefault: true },
      { name: 'second_default', isProfile: true, isDefault: true },
    ];
    expect(appDefaultProfileName(perms)).toBe('app_default');
  });

  it('treats a profile with no explicit isProfile flag as a profile', () => {
    expect(appDefaultProfileName([{ name: 'd', isDefault: true }])).toBe('d');
  });

  it('returns undefined when no default profile is declared', () => {
    expect(appDefaultProfileName([{ name: 'a', isProfile: true }])).toBeUndefined();
    expect(appDefaultProfileName([])).toBeUndefined();
    expect(appDefaultProfileName(undefined)).toBeUndefined();
    expect(appDefaultProfileName(null)).toBeUndefined();
    expect(appDefaultProfileName('nope')).toBeUndefined();
  });

  it('ignores a default flag on a non-profile add-on permission set', () => {
    expect(appDefaultProfileName([{ name: 'addon', isProfile: false, isDefault: true }])).toBeUndefined();
  });
});
