// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { checkApiExposure } from './api-exposure.js';

describe('checkApiExposure (#1889)', () => {
  it('falls open when the definition is unresolvable', () => {
    expect(checkApiExposure(undefined, 'get').allowed).toBe(true);
    expect(checkApiExposure(null, 'create').allowed).toBe(true);
  });

  it('allows by default (apiEnabled defaults true, no whitelist)', () => {
    expect(checkApiExposure({}, 'query').allowed).toBe(true);
    expect(checkApiExposure({ apiEnabled: true }, 'delete').allowed).toBe(true);
  });

  it('hides the object (404) when apiEnabled is false', () => {
    const d = checkApiExposure({ apiEnabled: false }, 'get');
    expect(d.allowed).toBe(false);
    expect(d.status).toBe(404);
  });

  describe('apiMethods whitelist', () => {
    it('allows a whitelisted operation', () => {
      // query maps to ApiMethod 'list'
      expect(checkApiExposure({ apiMethods: ['list', 'get'] }, 'query').allowed).toBe(true);
      expect(checkApiExposure({ apiMethods: ['list', 'get'] }, 'get').allowed).toBe(true);
    });

    it('blocks a non-whitelisted operation (405)', () => {
      const d = checkApiExposure({ apiMethods: ['list', 'get'] }, 'create');
      expect(d.allowed).toBe(false);
      expect(d.status).toBe(405);
      expect(d.reason).toContain('create');
    });

    it('maps delete/update/create/find correctly', () => {
      const ro = { apiMethods: ['list', 'get'] };
      expect(checkApiExposure(ro, 'delete').allowed).toBe(false);
      expect(checkApiExposure(ro, 'update').allowed).toBe(false);
      expect(checkApiExposure(ro, 'find').allowed).toBe(true); // find → list
    });

    it('an empty whitelist is treated as no restriction', () => {
      expect(checkApiExposure({ apiMethods: [] }, 'create').allowed).toBe(true);
    });

    it('does not gate actions with no ApiMethod mapping', () => {
      expect(checkApiExposure({ apiMethods: ['list'] }, 'somethingCustom').allowed).toBe(true);
    });
  });
});
