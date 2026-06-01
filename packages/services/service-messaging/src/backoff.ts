// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import type { AckResult } from './outbox.js';
import type { SendResult, ErrorClass } from './channel.js';

/**
 * Stable, framework-free partition hash (32-bit FNV-1a). Both the dispatcher
 * and the outbox `claim()` filter on it, so it must be a single shared helper.
 * Same implementation as `plugin-webhooks`.
 */
export function hashPartition(key: string, count: number): number {
    if (count <= 0) throw new Error('partition count must be > 0');
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return Math.abs(h | 0) % count;
}

/**
 * Exponential retry schedule with jitter. Returns the delay (ms) before the
 * next attempt given how many attempts have already happened, or `null` once
 * the budget is exhausted (→ dead).
 *
 *   attempt 1 fails → ~1s · 2 → ~10s · 3 → ~1m · 4 → ~10m · 5 → ~1h · 6+ → dead
 */
export function nextRetryDelayMs(attemptsSoFar: number, rng: () => number = Math.random): number | null {
    const SCHEDULE = [1_000, 10_000, 60_000, 600_000, 3_600_000];
    if (attemptsSoFar < 1 || attemptsSoFar > SCHEDULE.length) return null;
    const base = SCHEDULE[attemptsSoFar - 1];
    const jitter = 0.8 + rng() * 0.4; // ∈ [0.8, 1.2)
    return Math.floor(base * jitter);
}

/**
 * Turn a channel `send()` outcome into an {@link AckResult}, applying the retry
 * schedule on retriable failures.
 *
 * - `ok` → success.
 * - `errorClass` of `permanent` → dead immediately (no point retrying).
 * - `errorClass` of `invalid_recipient` → suppressed (not our transport's fault).
 * - otherwise (retryable / unknown) → schedule a retry, or dead once the budget
 *   is exhausted.
 */
export function classifyDeliveryAttempt(
    result: SendResult,
    errorClass: ErrorClass | undefined,
    attemptsSoFar: number,
    now: number = Date.now(),
    rng?: () => number,
): AckResult {
    if (result.ok) return { success: true };

    if (errorClass === 'invalid_recipient') {
        return { success: false, error: result.error, suppressed: true };
    }
    if (errorClass === 'permanent') {
        return { success: false, error: result.error, dead: true };
    }

    const delay = nextRetryDelayMs(attemptsSoFar + 1, rng);
    if (delay === null) {
        return { success: false, error: result.error, dead: true };
    }
    return { success: false, error: result.error, nextAttemptAt: now + delay };
}
