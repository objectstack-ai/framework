// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { createHmac, randomUUID } from 'node:crypto';
import type { HttpAckResult, HttpDelivery } from './http-outbox.js';

/**
 * Pure HTTP transport for the generic outbound-delivery outbox (ADR-0018 M3).
 *
 * Lifted and generalised from `plugin-webhooks/src/http-sender.ts`: a single
 * stateless attempt (`sendOnce`) plus the retry-schedule classifier
 * (`classifyAttempt`). The dispatcher owns claim/ack; this module owns the wire.
 */

/** Default per-request timeout. */
export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;

/** Truncate response bodies to keep storage cost predictable. */
const RESPONSE_BODY_CAP = 16 * 1024;

export type FetchImpl = (
    input: string,
    init: {
        method: string;
        headers: Record<string, string>;
        body: string;
        signal: AbortSignal;
    },
) => Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
}>;

/** Single HTTP attempt classified to an ack shape (without nextRetryAt). */
export type HttpAttemptOutcome =
    | { success: true; httpStatus: number; responseBody?: string; durationMs: number }
    | {
          success: false;
          retriable: boolean;
          httpStatus?: number;
          responseBody?: string;
          error?: string;
          durationMs: number;
      };

/**
 * Send one HTTP attempt for the delivery. Pure (no DB writes) so the dispatcher
 * owns retry-schedule + ack logic.
 *
 *   - 2xx                       → success
 *   - 4xx (except 408/429)      → permanent failure (retriable = false → dead)
 *   - 408, 429, 5xx, transport  → retriable
 */
export async function sendOnce(
    delivery: HttpDelivery,
    fetchImpl: FetchImpl,
): Promise<HttpAttemptOutcome> {
    const body =
        typeof delivery.payload === 'string'
            ? delivery.payload
            : JSON.stringify(delivery.payload ?? null);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'ObjectStack-Http/1.0',
        'X-Objectstack-Delivery': delivery.id,
        'X-Objectstack-Attempt': String(delivery.attempts + 1),
        ...(delivery.label ? { 'X-Objectstack-Event': delivery.label } : {}),
        ...(delivery.headers ?? {}),
    };
    if (delivery.signingSecret) {
        const sig = createHmac('sha256', delivery.signingSecret).update(body).digest('hex');
        headers['X-Objectstack-Signature'] = `sha256=${sig}`;
    }

    const timeoutMs = delivery.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
        const res = await fetchImpl(delivery.url, {
            method: delivery.method ?? 'POST',
            headers,
            body,
            signal: controller.signal,
        });
        clearTimeout(timer);
        const responseText = await safeReadBody(res);
        const durationMs = Date.now() - start;
        if (res.ok) {
            return { success: true, httpStatus: res.status, responseBody: responseText, durationMs };
        }
        const retriable = res.status === 408 || res.status === 429 || res.status >= 500;
        return {
            success: false,
            retriable,
            httpStatus: res.status,
            responseBody: responseText,
            error: `HTTP ${res.status}`,
            durationMs,
        };
    } catch (err: unknown) {
        clearTimeout(timer);
        const durationMs = Date.now() - start;
        const e = err as { name?: string; message?: string };
        const error = e?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : e?.message ?? String(err);
        return { success: false, retriable: true, error, durationMs };
    }
}

async function safeReadBody(res: { text(): Promise<string> }): Promise<string | undefined> {
    try {
        const text = await res.text();
        return text.length > RESPONSE_BODY_CAP ? text.slice(0, RESPONSE_BODY_CAP) : text;
    } catch {
        return undefined;
    }
}

/**
 * Stripe-style retry schedule. Returns the next delay (ms) given how many
 * attempts have already happened, or `null` once the budget is exhausted.
 *
 *   1→~1s · 2→~10s · 3→~1m · 4→~10m · 5→~1h · 6→~6h · 7→~24h · 8+→dead
 *
 * Each delay is multiplied by jitter ∈ [0.8, 1.2).
 */
export function nextHttpRetryDelayMs(
    attemptsSoFar: number,
    rng: () => number = Math.random,
): number | null {
    const SCHEDULE = [1_000, 10_000, 60_000, 600_000, 3_600_000, 21_600_000, 86_400_000];
    if (attemptsSoFar < 1 || attemptsSoFar > SCHEDULE.length) return null;
    const base = SCHEDULE[attemptsSoFar - 1];
    const jitter = 0.8 + rng() * 0.4;
    return Math.floor(base * jitter);
}

/**
 * Compose an {@link HttpAckResult} from an outcome, applying the retry schedule
 * on retriable failures.
 */
export function classifyAttempt(
    outcome: HttpAttemptOutcome,
    attemptsSoFar: number,
    now: number = Date.now(),
    rng?: () => number,
): HttpAckResult {
    if (outcome.success) return outcome;
    if (!outcome.retriable) {
        return {
            success: false,
            httpStatus: outcome.httpStatus,
            responseBody: outcome.responseBody,
            error: outcome.error,
            durationMs: outcome.durationMs,
            dead: true,
        };
    }
    const delay = nextHttpRetryDelayMs(attemptsSoFar + 1, rng);
    if (delay === null) {
        return {
            success: false,
            httpStatus: outcome.httpStatus,
            responseBody: outcome.responseBody,
            error: outcome.error,
            durationMs: outcome.durationMs,
            dead: true,
        };
    }
    return {
        success: false,
        httpStatus: outcome.httpStatus,
        responseBody: outcome.responseBody,
        error: outcome.error,
        durationMs: outcome.durationMs,
        nextRetryAt: now + delay,
    };
}

/** Generate a fresh delivery id (UUID v4). Exposed for tests. */
export function newDeliveryId(): string {
    return randomUUID();
}
