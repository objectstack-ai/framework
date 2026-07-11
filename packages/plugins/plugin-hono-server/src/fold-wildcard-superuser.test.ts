// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { foldWildcardSuperUser } from './hono-plugin.js';

/**
 * ADR-0057 D10 / ADR-0092 D5 — the `/me/permissions` per-object FLS map must
 * mirror the server's actual enforcement, which grants writes via a `'*'`
 * modifyAll super-user bypass regardless of another set's explicit per-object
 * deny (most-permissive merge, no deny-wins).
 */
describe('foldWildcardSuperUser', () => {
  it('lifts an explicit per-object deny when the wildcard is a modifyAll super-user grant', () => {
    const objects: Record<string, any> = {
      '*': { allowRead: true, allowEdit: true, viewAllRecords: true, modifyAllRecords: true },
      // As produced when admin_full_access ('*') composes with organization_admin
      // (explicit sys_user deny) — the naive merge leaves allowEdit:false.
      sys_user: { allowRead: true, allowEdit: false, allowCreate: false, allowDelete: false },
    };
    foldWildcardSuperUser(objects);
    expect(objects.sys_user).toMatchObject({ allowRead: true, allowEdit: true, allowCreate: true, allowDelete: true });
    // The wildcard entry itself is untouched.
    expect(objects['*'].modifyAllRecords).toBe(true);
  });

  it('viewAll-only wildcard lifts read but NOT write', () => {
    const objects: Record<string, any> = {
      '*': { allowRead: true, viewAllRecords: true },
      sys_session: { allowRead: false, allowEdit: false },
    };
    foldWildcardSuperUser(objects);
    expect(objects.sys_session.allowRead).toBe(true);
    expect(objects.sys_session.allowEdit).toBe(false);
  });

  it('no-ops when the wildcard is not a super-user grant', () => {
    const objects: Record<string, any> = {
      '*': { allowRead: true, allowEdit: true }, // plain allow, no view/modifyAll
      sys_user: { allowRead: true, allowEdit: false },
    };
    foldWildcardSuperUser(objects);
    expect(objects.sys_user.allowEdit).toBe(false); // untouched — no super-user bypass
  });

  it('no-ops when there is no wildcard entry', () => {
    const objects: Record<string, any> = { sys_user: { allowEdit: false } };
    foldWildcardSuperUser(objects);
    expect(objects.sys_user.allowEdit).toBe(false);
  });
});
