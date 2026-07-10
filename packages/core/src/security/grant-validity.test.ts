// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { isGrantActive, isGrantExpired } from './grant-validity.js';

/**
 * ADR-0091 D1/D2 — the single validity predicate every resolver shares.
 * Window is half-open [valid_from, valid_until) in UTC; null bounds are
 * unbounded; present-but-garbage bounds fail CLOSED.
 */
describe('isGrantActive', () => {
  const NOW = Date.parse('2026-07-10T12:00:00Z');

  it('null/absent bounds = unbounded (pre-ADR-0091 rows unchanged)', () => {
    expect(isGrantActive({}, NOW)).toBe(true);
    expect(isGrantActive({ valid_from: null, valid_until: null }, NOW)).toBe(true);
    expect(isGrantActive({ valid_from: '', valid_until: '' }, NOW)).toBe(true);
  });

  it('inactive before valid_from, active at and after it', () => {
    expect(isGrantActive({ valid_from: '2026-08-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isGrantActive({ valid_from: '2026-07-10T12:00:00Z' }, NOW)).toBe(true); // inclusive
    expect(isGrantActive({ valid_from: '2026-07-01T00:00:00Z' }, NOW)).toBe(true);
  });

  it('inactive AT and after valid_until (half-open)', () => {
    expect(isGrantActive({ valid_until: '2026-07-10T12:00:00Z' }, NOW)).toBe(false); // exclusive
    expect(isGrantActive({ valid_until: '2026-07-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isGrantActive({ valid_until: '2026-08-01T00:00:00Z' }, NOW)).toBe(true);
  });

  it('accepts number epochs (seconds and milliseconds) and Date objects', () => {
    expect(isGrantActive({ valid_until: NOW + 1000 }, NOW)).toBe(true);
    expect(isGrantActive({ valid_until: Math.floor((NOW - 1000) / 1000) }, NOW)).toBe(false); // seconds epoch
    expect(isGrantActive({ valid_until: new Date(NOW + 1000) }, NOW)).toBe(true);
    expect(isGrantActive({ valid_from: new Date(NOW + 1000) }, NOW)).toBe(false);
  });

  it('camelCase aliases are honored (driver row-shape tolerance)', () => {
    expect(isGrantActive({ validUntil: '2026-07-01T00:00:00Z' } as any, NOW)).toBe(false);
    expect(isGrantActive({ validFrom: '2026-08-01T00:00:00Z' } as any, NOW)).toBe(false);
  });

  it('fails CLOSED on unparseable bounds (unlike api-key isExpired)', () => {
    expect(isGrantActive({ valid_until: 'not-a-date' }, NOW)).toBe(false);
    expect(isGrantActive({ valid_from: 'garbage' }, NOW)).toBe(false);
    expect(isGrantActive({ valid_until: { weird: true } }, NOW)).toBe(false);
  });

  it('null/undefined row = no grant', () => {
    expect(isGrantActive(null, NOW)).toBe(false);
    expect(isGrantActive(undefined, NOW)).toBe(false);
  });
});

describe('isGrantExpired', () => {
  const NOW = Date.parse('2026-07-10T12:00:00Z');

  it('true only for a passed valid_until — not for not-yet-active rows', () => {
    expect(isGrantExpired({ valid_until: '2026-07-01T00:00:00Z' }, NOW)).toBe(true);
    expect(isGrantExpired({ valid_until: '2026-07-10T12:00:00Z' }, NOW)).toBe(true); // at the bound
    expect(isGrantExpired({ valid_until: '2026-08-01T00:00:00Z' }, NOW)).toBe(false);
    expect(isGrantExpired({ valid_from: '2026-08-01T00:00:00Z' }, NOW)).toBe(false); // pending ≠ expired
    expect(isGrantExpired({}, NOW)).toBe(false);
  });
});
