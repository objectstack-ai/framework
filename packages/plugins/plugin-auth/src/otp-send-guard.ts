// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Per-phone-number OTP send guard (#2780).
 *
 * SMS is a *paid* channel: every `/phone-number/send-otp` call costs real
 * money and better-auth sends to ANY number (the endpoint also serves the
 * change-phone verification flow), so an attacker can pump SMS to arbitrary
 * numbers ("SMS pumping" / toll fraud). better-auth's per-IP rate limit
 * doesn't survive IP rotation — this guard adds the missing per-NUMBER
 * dimension, independent of caller IP:
 *
 *  - **Cooldown**: at most one send per number per `cooldownSeconds`.
 *  - **Hourly cap**: at most `maxPerHour` sends per number per rolling hour.
 *
 * State lives in better-auth's `secondaryStorage` when wired (one shared
 * store across nodes — same reasoning as the rate-limit counters, ADR-0069
 * D2) and falls back to an in-process map otherwise. Counting is
 * best-effort (no cross-node atomicity), which is fine for an anti-abuse
 * throttle — the budget is small either way.
 *
 * Keys carry only the phone number and timestamps — never OTP codes.
 */

/**
 * Subset of better-auth's SecondaryStorage the guard needs. Return types are
 * deliberately loose (`unknown`) to stay assignable from better-auth's own
 * interface across versions; `load()` type-checks what comes back.
 */
export interface OtpGuardStorage {
  get(key: string): unknown;
  set(key: string, value: string, ttl?: number): unknown;
}

export interface OtpSendGuardOptions {
  /** Seconds a number must wait between two sends. Default 60. `0` disables. */
  cooldownSeconds?: number;
  /** Max sends per number per rolling hour. Default 5. `0` disables. */
  maxPerHour?: number;
  /** Shared cross-node store (better-auth secondaryStorage). Optional. */
  storage?: OtpGuardStorage;
  /** Clock override for tests. */
  now?: () => number;
}

export interface OtpSendDecision {
  ok: boolean;
  /** Seconds until the next send is allowed (set when `ok` is false). */
  retryAfterSeconds?: number;
}

const KEY_PREFIX = 'phone-otp-sends:';
const HOUR_MS = 3_600_000;

export class OtpSendGuard {
  private readonly cooldownMs: number;
  private readonly maxPerHour: number;
  private readonly storage?: OtpGuardStorage;
  private readonly now: () => number;
  /** In-process fallback store: phone → send timestamps (ms). */
  private readonly local = new Map<string, number[]>();

  constructor(options: OtpSendGuardOptions = {}) {
    this.cooldownMs = Math.max(0, Math.floor(options.cooldownSeconds ?? 60)) * 1000;
    this.maxPerHour = Math.max(0, Math.floor(options.maxPerHour ?? 5));
    this.storage = options.storage;
    this.now = options.now ?? Date.now;
  }

  /**
   * Check whether `phoneNumber` may receive another OTP now and, if so,
   * record the send. Never throws — a broken store fails OPEN (an SMS
   * throttle must not take sign-in down with it).
   */
  async checkAndRecord(phoneNumber: string): Promise<OtpSendDecision> {
    if (this.cooldownMs === 0 && this.maxPerHour === 0) return { ok: true };
    const now = this.now();
    try {
      const key = KEY_PREFIX + phoneNumber;
      const history = (await this.load(key)).filter((t) => now - t < HOUR_MS);

      const last = history.length ? Math.max(...history) : undefined;
      if (this.cooldownMs > 0 && last !== undefined && now - last < this.cooldownMs) {
        return { ok: false, retryAfterSeconds: Math.ceil((this.cooldownMs - (now - last)) / 1000) };
      }
      if (this.maxPerHour > 0 && history.length >= this.maxPerHour) {
        const oldest = Math.min(...history);
        return { ok: false, retryAfterSeconds: Math.ceil((HOUR_MS - (now - oldest)) / 1000) };
      }

      history.push(now);
      await this.save(key, history);
      return { ok: true };
    } catch {
      return { ok: true }; // fail open — see doc comment
    }
  }

  private async load(key: string): Promise<number[]> {
    if (this.storage) {
      const raw = await this.storage.get(key);
      if (typeof raw !== 'string' || raw.length === 0) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'number') : [];
      } catch {
        return [];
      }
    }
    return this.local.get(key) ?? [];
  }

  private async save(key: string, history: number[]): Promise<void> {
    if (this.storage) {
      // TTL = the rolling window; the entry self-expires once irrelevant.
      await this.storage.set(key, JSON.stringify(history), Math.ceil(HOUR_MS / 1000));
      return;
    }
    this.local.set(key, history);
    // Opportunistic pruning keeps the fallback map bounded under abuse.
    if (this.local.size > 10_000) {
      const cutoff = this.now() - HOUR_MS;
      for (const [k, v] of this.local) {
        const alive = v.filter((t) => t > cutoff);
        if (alive.length === 0) this.local.delete(k);
        else this.local.set(k, alive);
      }
    }
  }
}
