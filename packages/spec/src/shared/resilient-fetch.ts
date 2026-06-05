// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `resilientFetch` — a thin, dependency-free wrapper around `fetch` that gives
 * outbound HTTP calls a **per-attempt timeout** and **bounded exponential
 * backoff** so a slow or rate-limited external API can't hang the caller (e.g. an
 * agent turn) indefinitely with no recovery.
 *
 * Used by the HTTP-based connectors and embedders (`connector-rest`,
 * `connector-slack`, `embedder-openai`). It is intentionally NOT a circuit
 * breaker — that is stateful, per-host, and a separate concern; this fixes the
 * "naked fetch hangs / never retries a transient blip" gap.
 *
 * Behaviour:
 *  - aborts each attempt after `timeoutMs` (default 30s);
 *  - retries on a network error or a retryable status (429 / 5xx) up to
 *    `retries` total attempts (default 3), with exponential backoff + jitter;
 *  - honours a `Retry-After` header (seconds or HTTP-date) on a 429;
 *  - never retries when the **caller's** own `signal` aborts (that's intentional
 *    cancellation, not a transient failure).
 */
export interface ResilientFetchOptions {
    /** fetch implementation (injectable for tests / non-global runtimes). */
    fetchImpl?: typeof fetch;
    /** Per-attempt timeout in ms. Default 30000. */
    timeoutMs?: number;
    /** Total attempts including the first. Default 3. */
    retries?: number;
    /** Base backoff in ms; doubled each retry, plus jitter. Default 300. */
    backoffBaseMs?: number;
    /** Predicate for retryable HTTP statuses. Default: 429 or >= 500. */
    retryableStatus?: (status: number) => boolean;
    /** Sleep impl (injectable for deterministic tests). */
    sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF_BASE_MS = 300;

const defaultRetryable = (status: number): boolean => status === 429 || status >= 500;
const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function resilientFetch(
    input: string | URL,
    init: RequestInit = {},
    opts: ResilientFetchOptions = {},
): Promise<Response> {
    const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
    if (!fetchImpl) {
        throw new Error('resilientFetch: no fetch implementation (pass opts.fetchImpl or run on a fetch-capable runtime)');
    }
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxAttempts = Math.max(1, opts.retries ?? DEFAULT_RETRIES);
    const backoffBaseMs = opts.backoffBaseMs ?? DEFAULT_BACKOFF_BASE_MS;
    const isRetryable = opts.retryableStatus ?? defaultRetryable;
    const sleep = opts.sleep ?? defaultSleep;
    const callerSignal = init.signal ?? undefined;

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const onCallerAbort = () => controller.abort((callerSignal as AbortSignal | undefined)?.reason);
        if (callerSignal) {
            if (callerSignal.aborted) controller.abort((callerSignal as AbortSignal).reason);
            else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
        }
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort(new Error(`resilientFetch: request timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        try {
            const res = await fetchImpl(input, { ...init, signal: controller.signal });
            if (isRetryable(res.status) && attempt < maxAttempts) {
                await sleep(retryDelayMs(res, attempt, backoffBaseMs));
                continue;
            }
            return res;
        } catch (err) {
            lastError = err;
            // The caller cancelled (not our timeout) → propagate, never retry.
            if (callerSignal?.aborted && !timedOut) throw err;
            if (attempt >= maxAttempts) break;
            await sleep(backoffMs(attempt, backoffBaseMs));
        } finally {
            clearTimeout(timer);
            callerSignal?.removeEventListener?.('abort', onCallerAbort);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Exponential backoff with small jitter to avoid synchronized retries. */
function backoffMs(attempt: number, base: number): number {
    return base * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
}

/** Retry delay for a response: honour `Retry-After` on 429, else backoff. */
function retryDelayMs(res: Response, attempt: number, base: number): number {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
        const secs = Number(retryAfter);
        if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
        const dateMs = Date.parse(retryAfter);
        if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
    }
    return backoffMs(attempt, base);
}
