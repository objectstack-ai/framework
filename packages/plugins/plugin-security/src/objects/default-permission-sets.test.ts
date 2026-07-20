// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
// #3325 — pin the better-auth managed-object deny-list against the real schemas
// so it can never silently drift again (ADR-0092: registry-driven, no rot).

import { describe, it, expect } from 'vitest';
import * as PlatformObjects from '@objectstack/platform-objects';
import { defaultPermissionSets, BETTER_AUTH_MANAGED_OBJECTS } from './default-permission-sets.js';
import { MANAGED_DENY_TARGET_SETS } from '../managed-object-write-denies.js';

// Every object schema the platform-objects package exports whose bucket is
// `better-auth` — the ground truth the static baseline must mirror.
const betterAuthSchemaNames = Object.values(PlatformObjects as Record<string, any>)
  .filter((v) => v && typeof v === 'object' && typeof v.name === 'string' && v.managedBy === 'better-auth')
  .map((v) => v.name as string)
  .sort();

const listNames = [...BETTER_AUTH_MANAGED_OBJECTS].sort();
const setByName = (name: string): any => defaultPermissionSets.find((s) => s.name === name);

describe('BETTER_AUTH_MANAGED_OBJECTS ↔ schemas (drift pin, #3325)', () => {
  it('found the better-auth identity schemas to compare against', () => {
    // Guard against a broken import silently passing the bidirectional check.
    expect(betterAuthSchemaNames.length).toBeGreaterThanOrEqual(20);
  });

  it('every listed name is a real object declaring managedBy:"better-auth"', () => {
    const notBetterAuth = listNames.filter((n) => !betterAuthSchemaNames.includes(n));
    expect(notBetterAuth).toEqual([]);
  });

  it('every better-auth schema is in the list (this is the drift that #3325 fixes)', () => {
    const missing = betterAuthSchemaNames.filter((n) => !listNames.includes(n));
    expect(missing).toEqual([]);
  });

  it('the list has no duplicates', () => {
    expect(listNames.length).toBe(new Set(listNames).size);
  });
});

describe('default permission sets carry the managed denies (static baseline)', () => {
  it('each write-granting target set denies create/edit/delete on every managed object', () => {
    for (const setName of MANAGED_DENY_TARGET_SETS) {
      const set = setByName(setName);
      expect(set, `set ${setName} exists`).toBeTruthy();
      for (const obj of BETTER_AUTH_MANAGED_OBJECTS) {
        const entry = set.objects[obj];
        expect(entry, `${setName} has entry for ${obj}`).toBeTruthy();
        expect(entry.allowCreate).toBe(false);
        expect(entry.allowEdit).toBe(false);
        expect(entry.allowDelete).toBe(false);
        expect(entry.allowRead).toBe(true);
      }
    }
  });

  it('admin_full_access keeps its bare wildcard (zero per-object entries) — admin rescue path', () => {
    const admin = setByName('admin_full_access');
    expect(admin).toBeTruthy();
    expect(Object.keys(admin.objects)).toEqual(['*']);
  });
});
