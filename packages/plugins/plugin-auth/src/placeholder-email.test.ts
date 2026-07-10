// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  generatePlaceholderEmail,
  isPlaceholderEmail,
  PLACEHOLDER_EMAIL_DOMAIN,
} from './placeholder-email.js';

describe('placeholder-email (#2766 V1.5)', () => {
  it('generates addresses under the reserved .invalid domain', () => {
    const email = generatePlaceholderEmail();
    expect(email).toMatch(/^u-[a-z2-7]{20}@placeholder\.invalid$/);
    expect(PLACEHOLDER_EMAIL_DOMAIN.endsWith('.invalid')).toBe(true);
  });

  it('round-trips through isPlaceholderEmail', () => {
    expect(isPlaceholderEmail(generatePlaceholderEmail())).toBe(true);
  });

  it('never derives the local part from PII: real phone numbers cannot appear', () => {
    // The local part is random base32 (alphabet a-z + 2-7): the digits 0/1/8/9
    // can never occur, so no real-world phone number (they all contain at
    // least one of those in practice — and critically, the token is NOT
    // derived from the phone at all).
    for (let i = 0; i < 100; i++) {
      const local = generatePlaceholderEmail().split('@')[0];
      expect(/[0189]/.test(local)).toBe(false);
      expect(local).not.toContain('13800000000');
    }
  });

  it('generates distinct values', () => {
    const seen = new Set(Array.from({ length: 100 }, () => generatePlaceholderEmail()));
    expect(seen.size).toBe(100);
  });

  it('rejects real addresses and junk', () => {
    expect(isPlaceholderEmail('alice@example.com')).toBe(false);
    expect(isPlaceholderEmail('u-abc@placeholder.invalid.example.com')).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
    expect(isPlaceholderEmail(undefined)).toBe(false);
    expect(isPlaceholderEmail(42)).toBe(false);
  });

  it('recognition is case-insensitive on the domain', () => {
    expect(isPlaceholderEmail('u-abc@PLACEHOLDER.INVALID')).toBe(true);
  });
});
