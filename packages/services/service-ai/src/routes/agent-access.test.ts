// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { evaluateAgentAccess } from './agent-access.js';

describe('evaluateAgentAccess (#1884)', () => {
  const user = (over: Partial<{ userId: string; roles: string[]; permissions: string[] }> = {}) => ({
    userId: 'u1',
    roles: [] as string[],
    permissions: [] as string[],
    ...over,
  });

  it('allows when the agent declares no access/permissions', () => {
    expect(evaluateAgentAccess({}, user()).allowed).toBe(true);
    expect(evaluateAgentAccess({ visibility: 'private' }, user()).allowed).toBe(true);
  });

  it('fails closed when the user is missing', () => {
    const d = evaluateAgentAccess({ access: ['u1'] }, undefined);
    expect(d.allowed).toBe(false);
  });

  describe('required permissions (must hold ALL)', () => {
    it('denies when a required permission is missing', () => {
      const d = evaluateAgentAccess({ permissions: ['hr:read', 'hr:write'] }, user({ permissions: ['hr:read'] }));
      expect(d.allowed).toBe(false);
      expect(d.reason).toContain('hr:write');
    });

    it('allows when all are held via permissions', () => {
      expect(evaluateAgentAccess({ permissions: ['hr:read'] }, user({ permissions: ['hr:read'] })).allowed).toBe(true);
    });

    it('satisfies a required entry via roles too (permissions OR roles)', () => {
      expect(evaluateAgentAccess({ permissions: ['manager'] }, user({ roles: ['manager'] })).allowed).toBe(true);
    });
  });

  describe('access allow-list (must match one)', () => {
    it('allows a listed user id', () => {
      expect(evaluateAgentAccess({ access: ['u1', 'u2'] }, user()).allowed).toBe(true);
    });

    it('allows a listed role', () => {
      expect(evaluateAgentAccess({ access: ['support'] }, user({ roles: ['support'] })).allowed).toBe(true);
    });

    it('denies a caller not on the list', () => {
      const d = evaluateAgentAccess({ access: ['u2', 'admins'] }, user({ userId: 'u1', roles: ['sales'] }));
      expect(d.allowed).toBe(false);
      expect(d.reason).toMatch(/access list/);
    });
  });

  it('enforces permissions AND allow-list together', () => {
    const agent = { permissions: ['ai:beta'], access: ['vip'] };
    // has permission but not on allow-list
    expect(evaluateAgentAccess(agent, user({ permissions: ['ai:beta'], roles: [] })).allowed).toBe(false);
    // on allow-list but missing permission
    expect(evaluateAgentAccess(agent, user({ roles: ['vip'], permissions: [] })).allowed).toBe(false);
    // both satisfied
    expect(evaluateAgentAccess(agent, user({ roles: ['vip'], permissions: ['ai:beta'] })).allowed).toBe(true);
  });
});
