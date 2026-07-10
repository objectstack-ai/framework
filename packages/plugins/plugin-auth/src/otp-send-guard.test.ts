// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { OtpSendGuard, type OtpGuardStorage } from './otp-send-guard.js';

const PHONE = '+8613800000000';

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => { now += ms; } };
}

describe('OtpSendGuard', () => {
  it('allows the first send and enforces the cooldown on the second', async () => {
    const c = clock();
    const guard = new OtpSendGuard({ cooldownSeconds: 60, maxPerHour: 5, now: c.now });

    expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
    const denied = await guard.checkAndRecord(PHONE);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);

    c.advance(61_000);
    expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
  });

  it('tracks numbers independently', async () => {
    const c = clock();
    const guard = new OtpSendGuard({ cooldownSeconds: 60, now: c.now });
    expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
    expect((await guard.checkAndRecord('+15005550006')).ok).toBe(true);
  });

  it('enforces the rolling hourly cap even outside the cooldown', async () => {
    const c = clock();
    const guard = new OtpSendGuard({ cooldownSeconds: 1, maxPerHour: 3, now: c.now });
    for (let i = 0; i < 3; i++) {
      expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
      c.advance(2_000);
    }
    const denied = await guard.checkAndRecord(PHONE);
    expect(denied.ok).toBe(false);

    // The window rolls: an hour after the FIRST send, one slot frees up.
    c.advance(3_600_000 - 4_000);
    expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
  });

  it('0 disables both dimensions', async () => {
    const guard = new OtpSendGuard({ cooldownSeconds: 0, maxPerHour: 0 });
    for (let i = 0; i < 10; i++) {
      expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
    }
  });

  it('uses the shared storage when provided (cross-node)', async () => {
    const c = clock();
    const kv = new Map<string, string>();
    const storage: OtpGuardStorage = {
      get: (k) => kv.get(k) ?? null,
      set: (k, v) => { kv.set(k, v); },
    };
    const nodeA = new OtpSendGuard({ cooldownSeconds: 60, storage, now: c.now });
    const nodeB = new OtpSendGuard({ cooldownSeconds: 60, storage, now: c.now });

    expect((await nodeA.checkAndRecord(PHONE)).ok).toBe(true);
    // A different node sees the same budget.
    expect((await nodeB.checkAndRecord(PHONE)).ok).toBe(false);
  });

  it('fails OPEN when the storage breaks (throttle must not take sign-in down)', async () => {
    const storage: OtpGuardStorage = {
      get: () => { throw new Error('redis down'); },
      set: () => { throw new Error('redis down'); },
    };
    const guard = new OtpSendGuard({ cooldownSeconds: 60, storage });
    expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
    expect((await guard.checkAndRecord(PHONE)).ok).toBe(true);
  });
});
